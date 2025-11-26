import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { SupportQueueService } from '../../services/SupportQueueService';
import { LoggingService } from '../../services/LoggingService';
import type { AppConfig, GuildConfig } from '../../types/config';
import { ModuleService } from '../../services/ModuleService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const MODULE_KEY = 'tickets';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('supportqueue')
    .setDescription('Voice-Support-Warteschlange einsehen und verwalten')
    .addSubcommand((sub) => sub.setName('status').setDescription('Aktuelle Warteschlange anzeigen'))
    .addSubcommand((sub) => sub.setName('skip').setDescription('Naechsten Eintrag in der Queue ueberspringen'))
    .addSubcommand((sub) => sub.setName('clear').setDescription('Warteschlange leeren (nur Admin/Support)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect),
  guildOnly: true,
  async execute(interaction, config: AppConfig) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId || !interaction.guild) {
      await interaction.reply({
        content: 'Dieser Command kann nur in einem Server verwendet werden.',
        ephemeral: true
      });
      return;
    }

    const guildConfig = getGuildConfig(config, guildId);
    if (!guildConfig) {
      await interaction.reply({
        content: 'Keine Guild-Konfiguration gefunden.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'status') {
      const queue = SupportQueueService.getQueue(guildId);
      const embed = new EmbedBuilder()
        .setTitle('Voice-Support Warteschlange')
        .setDescription(
          queue.length === 0
            ? 'Aktuell wartet niemand in der Warteschlange.'
            : queue
                .map(
                  (entry, index) =>
                    `${index + 1}. <@${entry.userId}> - seit <t:${Math.floor(
                      entry.joinedAt.getTime() / 1000
                    )}:R>`
                )
                .join('\n')
        )
        .setTimestamp(new Date());

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Staff-only from here, but also allow via permission profile tickets.manage_queue
    const member = interaction.member;
    const memberRoleIds: string[] =
      member && 'roles' in member
        ? Array.from(((member as any).roles?.cache?.keys?.() as Iterable<string> | undefined) ?? [])
        : [];

    const hasProfilePermission = await ModuleService.memberHasAction(
      guildId,
      memberRoleIds,
      MODULE_KEY,
      'manage_queue'
    );

    const staffRoleIds = [
      guildConfig.roles.support,
      guildConfig.roles.moderator,
      guildConfig.roles.admin,
      guildConfig.roles.owner
    ];

    const rolesManager = member && 'roles' in member ? (member as any).roles : null;
    const hasStaffRole =
      rolesManager != null && staffRoleIds.some((id) => rolesManager.cache.has(id));

    if (!hasStaffRole && !hasProfilePermission) {
      await interaction.reply({
        content: 'Dieser Subcommand ist nur fuer Support-/Staff-Rollen verfuegbar.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'skip') {
      const next = SupportQueueService.popNext(guildId);
      await LoggingService.logSupportEvent(
        interaction.guild,
        config,
        'Support-Queue Skip',
        next
          ? `Eintrag ${next.userId} wurde aus der Queue entfernt.`
          : 'Skip ausgefuehrt, aber Queue war leer.'
      );
      await interaction.reply({
        content: next
          ? `Der naechste Wartende (<@${next.userId}>) wurde aus der Queue entfernt.`
          : 'Keine Eintraege in der Warteschlange.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'clear') {
      SupportQueueService.clearQueue(guildId);
      await LoggingService.logSupportEvent(
        interaction.guild,
        config,
        'Support-Queue Reset',
        'Die Warteschlange wurde geleert.'
      );
      await interaction.reply({
        content: 'Die Support-Warteschlange wurde geleert.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;
