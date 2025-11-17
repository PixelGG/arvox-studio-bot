import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { SupportQueueService } from '../../services/SupportQueueService';
import type { AppConfig, GuildConfig } from '../../types/config';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('supportqueue')
    .setDescription('Voice-Support-Warteschlange einsehen und verwalten')
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Aktuelle Warteschlange anzeigen')
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Warteschlange leeren (nur Admin/Support)')
    )
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
                    `${index + 1}. <@${entry.userId}> – seit <t:${Math.floor(
                      entry.joinedAt.getTime() / 1000
                    )}:R>`
                )
                .join('\n')
        )
        .setTimestamp(new Date());

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === 'clear') {
      // Nur Staff darf löschen
      const member = interaction.member;
      if (!member || !('roles' in member)) {
        await interaction.reply({
          content: 'Fehlende Berechtigung.',
          ephemeral: true
        });
        return;
      }

      const staffRoleIds = [
        guildConfig.roles.support,
        guildConfig.roles.moderator,
        guildConfig.roles.admin,
        guildConfig.roles.owner
      ];

      const rolesManager = 'roles' in member ? (member.roles as any) : null;
      const hasStaffRole =
        rolesManager != null && staffRoleIds.some((id) => rolesManager.cache.has(id));
      if (!hasStaffRole) {
        await interaction.reply({
          content: 'Dieser Subcommand ist nur für Support-/Staff-Rollen verfügbar.',
          ephemeral: true
        });
        return;
      }

      SupportQueueService.clearQueue(guildId);
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
