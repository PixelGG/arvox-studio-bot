import {
  ActionRowBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';
import { PersistentMessageService } from '../../services/PersistentMessageService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Self-Roles Panel verwalten')
    .addSubcommand((sub) =>
      sub
        .setName('post')
        .setDescription('Rollen-Panel als persistente Nachricht posten/aktualisieren')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  guildOnly: true,
  requiredRoleKeys: ['owner', 'admin', 'devLead'],
  async execute(interaction, config: AppConfig) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'post') {
      await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
      return;
    }

    const guildId = interaction.guildId;
    if (!guildId) {
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

    await PersistentMessageService.ensurePersistentMessage(
      interaction.client,
      guildId,
      'roles_panel',
      guildConfig.rolesPanel.channelId,
      () => {
        const embed = {
          title: 'Benachrichtigungsrollen wählen',
          description:
            'Wähle die Rollen aus, über die du informiert werden möchtest. Du kannst deine Auswahl jederzeit ändern.',
          timestamp: new Date().toISOString()
        };

        const select = new StringSelectMenuBuilder()
          .setCustomId('roles_panel_select')
          .setPlaceholder('Wähle deine Rollen...')
          .setMinValues(0)
          .setMaxValues(
            Math.max(
              0,
              Math.min(
                25,
                guildConfig.rolesPanel.maxSelections ?? guildConfig.rolesPanel.options.length
              )
            )
          )
          .addOptions(
            guildConfig.rolesPanel.options.map((option) => ({
              label: option.label,
              description: option.description,
              value: option.roleId
            }))
          );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

        return {
          embeds: [embed],
          components: [row]
        };
      }
    );

    await interaction.reply({
      content: 'Rollen-Panel wurde gepostet/aktualisiert.',
      ephemeral: true
    });
  }
};

export default command;

