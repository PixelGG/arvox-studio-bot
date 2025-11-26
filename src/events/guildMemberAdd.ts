import type { GuildMember, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import type { AppConfig, GuildConfig } from '../types/config';
import { LoggingService } from '../services/LoggingService';
import { AutoRoleRuleModel } from '../db/models/AutoRoleRule';
import { JoinLeaveModel } from '../db/models/JoinLeave';

function getGuildConfig(config: AppConfig, guildId: string): GuildConfig | undefined {
  return config.guilds[guildId];
}

const event: DiscordEvent = {
  name: 'guildMemberAdd',
  async execute(_client, config, ...args: unknown[]) {
    const [member] = args as [GuildMember];
    await LoggingService.logMemberJoin(member, config);
    await JoinLeaveModel.create({
      guildId: member.guild.id,
      userId: member.id,
      type: 'join',
      occurredAt: new Date()
    }).catch(() => null);

    const guildConfig = getGuildConfig(config, member.guild.id);
    if (!guildConfig || !guildConfig.welcome.enabled) return;

    const channel = member.guild.channels.cache.get(
      guildConfig.welcome.channelId
    ) as TextChannel | undefined;
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('Willkommen bei Arvox Studio')
      .setDescription(
        'Schön, dass du da bist! Schau dir bitte zuerst die Regeln an und wähle deine Rollen.'
      )
      .addFields(
        { name: 'Regeln lesen', value: `<#${guildConfig.channels.rules}>` },
        { name: 'Rollen wählen', value: `<#${guildConfig.channels.roles}>` },
        { name: 'Vorstellen', value: 'Stell dich gerne im #introductions Channel vor. (TODO: Channel-ID konfigurieren)' }
      )
      .setFooter({ text: `User-ID: ${member.id}` })
      .setTimestamp(new Date());

    await channel.send({ content: `<@${member.id}>`, embeds: [embed] });

    if (guildConfig.welcome.dmEnabled) {
      try {
        await member.send({
          content:
            'Willkommen bei Arvox Studio! Bitte lies die Regeln und wähle deine Rollen, um loszulegen.'
        });
      } catch {
        // ignore DM errors
      }
    }

    if (guildConfig.welcome.autoRoles.length > 0) {
      for (const roleId of guildConfig.welcome.autoRoles) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
          await member.roles.add(role);
        }
      }
    }

    const autoRules = await AutoRoleRuleModel.find({
      guildId: member.guild.id,
      condition: 'immediate',
      enabled: true
    }).exec();
    for (const rule of autoRules) {
      const role = member.guild.roles.cache.get(rule.roleId);
      if (role) {
        if (rule.delayMinutes && rule.delayMinutes > 0) {
          setTimeout(() => {
            member.roles.add(role).catch(() => null);
          }, rule.delayMinutes * 60_000);
        } else {
          await member.roles.add(role).catch(() => null);
        }
      }
    }
  }
};

export default event;
