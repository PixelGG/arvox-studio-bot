import { PermissionFlagsBits, type GuildMember, type Message, type TextChannel } from 'discord.js';
import { WarningModel, type WarningSeverity } from '../db/models/Warning';
import { MuteModel, type MuteType } from '../db/models/Mute';
import { BanModel, type BanType } from '../db/models/Ban';
import { AutomodRuleModel, type AutomodRuleDocument } from '../db/models/AutomodRule';
import { LoggingService } from './LoggingService';
import type { AppConfig } from '../types/config';
import { ModuleService } from './ModuleService';

interface ActionResult {
  ok: boolean;
  message?: string;
}

export class ModerationService {
  static async warn(
    message: Message,
    target: GuildMember,
    severity: WarningSeverity,
    reason: string,
    points: number
  ): Promise<void> {
    await WarningModel.create({
      guildId: message.guild!.id,
      userId: target.id,
      moderatorId: message.author.id,
      reason,
      severity,
      points
    });

    await LoggingService.logAuditEvent(
      message.guild!,
      { defaultGuildId: message.guild!.id, guilds: { [message.guild!.id]: (message.guild as any).config ?? {} } } as AppConfig,
      'Warnung',
      `${target} wurde verwarnt: ${reason} (${severity}, ${points} Punkte)`
    );
  }

  static async mute(
    moderator: GuildMember,
    target: GuildMember,
    type: MuteType,
    durationMinutes: number | null,
    reason?: string
  ): Promise<ActionResult> {
    const guild = moderator.guild;
    const startAt = new Date();
    const endAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60_000) : undefined;

    if (type === 'timeout') {
      try {
        await target.timeout(durationMinutes ? durationMinutes * 60_000 : 24 * 60 * 60_000, reason ?? 'Timeout');
      } catch (error) {
        return { ok: false, message: 'Timeout fehlgeschlagen.' };
      }
    } else {
      const mutedRoleId = (guild as any).config?.roles?.muted;
      if (!mutedRoleId) return { ok: false, message: 'Muted-Rolle nicht konfiguriert.' };
      await target.roles.add(mutedRoleId).catch(() => null);
    }

    await MuteModel.create({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      type,
      reason,
      startAt,
      endAt,
      active: true
    });

    return { ok: true };
  }

  static async unmute(
    moderator: GuildMember,
    target: GuildMember,
    reason?: string
  ): Promise<void> {
    const guild = moderator.guild;
    await target.timeout(null).catch(() => null);
    const mutedRoleId = (guild as any).config?.roles?.muted;
    if (mutedRoleId) {
      await target.roles.remove(mutedRoleId).catch(() => null);
    }

    await MuteModel.updateMany(
      { guildId: guild.id, userId: target.id, active: true },
      { $set: { active: false, endAt: new Date() } }
    ).exec();

    await LoggingService.logAuditEvent(
      guild,
      { defaultGuildId: guild.id, guilds: { [guild.id]: (guild as any).config ?? {} } } as AppConfig,
      'Unmute',
      `${target} wurde entmutet. ${reason ?? ''}`
    );
  }

  static async ban(
    moderator: GuildMember,
    targetId: string,
    type: BanType,
    durationMinutes?: number,
    reason?: string
  ): Promise<ActionResult> {
    const guild = moderator.guild;
    const startAt = new Date();
    const endAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60_000) : undefined;

    try {
      await guild.bans.create(targetId, {
        reason: reason ?? undefined,
        deleteMessageSeconds: 60 * 60 * 24
      });
    } catch {
      return { ok: false, message: 'Ban fehlgeschlagen.' };
    }

    await BanModel.create({
      guildId: guild.id,
      userId: targetId,
      moderatorId: moderator.id,
      reason,
      type,
      startAt,
      endAt,
      active: true
    });

    return { ok: true };
  }

  static async unban(
    moderator: GuildMember,
    targetId: string,
    reason?: string
  ): Promise<void> {
    const guild = moderator.guild;
    await guild.bans.remove(targetId, reason ?? undefined).catch(() => null);
    await BanModel.updateMany(
      { guildId: guild.id, userId: targetId, active: true },
      { $set: { active: false, endAt: new Date() } }
    ).exec();
  }

  static async liftExpiredPunishments(client: import('discord.js').Client): Promise<void> {
    const now = new Date();
    const expiredMutes = await MuteModel.find({ active: true, endAt: { $lte: now } }).exec();
    for (const mute of expiredMutes) {
      const guild = await client.guilds.fetch(mute.guildId).catch(() => null);
      if (!guild) continue;
      const member = await guild.members.fetch(mute.userId).catch(() => null);
      if (!member) continue;
      await this.unmute(member, member, 'Automatische Entmute');
    }

    const expiredBans = await BanModel.find({ active: true, endAt: { $lte: now } }).exec();
    for (const ban of expiredBans) {
      const guild = await client.guilds.fetch(ban.guildId).catch(() => null);
      if (!guild) continue;
      await guild.bans.remove(ban.userId, 'Tempban abgelaufen').catch(() => null);
      ban.active = false;
      await ban.save().catch(() => null);
    }
  }

  // Automod
  static async evaluateAutomod(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;
    const rules = await AutomodRuleModel.find({ guildId: message.guild.id, enabled: true }).exec();
    if (rules.length === 0) return;

    const content = message.content ?? '';
    for (const rule of rules) {
      if (this.matchesRule(rule, content, message)) {
        await this.applyAutomodAction(rule, message);
        break;
      }
    }
  }

  private static matchesRule(rule: AutomodRuleDocument, content: string, message: Message): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    switch (rule.type) {
      case 'badword':
        if (!rule.pattern) return false;
        return lower.includes(rule.pattern.toLowerCase());
      case 'invite':
        return lower.includes('discord.gg/');
      case 'caps':
        return content.length >= 10 && content === content.toUpperCase();
      case 'emote':
        return (content.match(/<:\w+:\d+>/g) ?? []).length >= (rule.threshold ?? 5);
      case 'repeat':
        return content.length > 0 && new Set(content.split(' ')).size <= (rule.threshold ?? 1);
      case 'link':
        return /(https?:\/\/)/i.test(content);
      default:
        return false;
    }
  }

  private static async applyAutomodAction(rule: AutomodRuleDocument, message: Message): Promise<void> {
    const guild = message.guild!;
    const member = await guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return;

    const points = rule.points ?? 1;
    const reason = `Automod (${rule.name})`;

    if (rule.action === 'delete') {
      await message.delete().catch(() => null);
    }

    if (rule.action === 'warn') {
      await this.warn(message, member, 'medium', reason, points);
    }

    if (rule.action === 'mute') {
      await this.mute(member, member, 'timeout', rule.durationMinutes ?? 10, reason);
    }

    if (rule.action === 'tempban') {
      await this.ban(member, member.id, 'tempban', rule.durationMinutes ?? 60, reason);
    }

    if (rule.action === 'ban') {
      await this.ban(member, member.id, 'ban', undefined, reason);
    }

    await LoggingService.logAutomodEvent(
      guild,
      { defaultGuildId: guild.id, guilds: { [guild.id]: (guild as any).config ?? {} } } as AppConfig,
      'Automod Treffer',
      `${member.user.tag} (${member.id}) Trigger: ${rule.name}`
    );
  }

  static async memberHasModerationRight(
    guildId: string,
    member: GuildMember,
    moduleAction: string,
    fallbackPerm?: bigint
  ): Promise<boolean> {
    if (fallbackPerm && member.permissions.has(fallbackPerm)) {
      return true;
    }
    const roleIds = Array.from(member.roles.cache.keys());
    return ModuleService.memberHasAction(guildId, roleIds, 'moderation', moduleAction);
  }
}
