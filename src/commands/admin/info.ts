import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';
import { PersistentMessageService } from '../../services/PersistentMessageService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Info-Panel verwalten')
    .addSubcommand((sub) =>
      sub.setName('post').setDescription('Info-Embed als persistente Nachricht posten/aktualisieren')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
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
      'info_main',
      guildConfig.info.channelId,
      () => {
        const fields = [
          {
            name: 'Über den Server',
            value: guildConfig.info.description
          },
          {
            name: 'Wichtige Channels',
            value:
              `• Willkommen: <#${guildConfig.channels.welcome}>\n` +
              `• Regeln: <#${guildConfig.channels.rules}>\n` +
              `• Rollen: <#${guildConfig.channels.roles}>\n` +
              `• Support: <#${guildConfig.channels.support}>`
          },
          {
            name: 'Externe Links',
            value:
              guildConfig.info.links
                .map((link) => `[${link.label}](${link.url})`)
                .join(' • ') || 'Keine Links konfiguriert.'
          }
        ];

        return {
          embeds: [
            {
              title: 'Arvox Studio – Info',
              description:
                'Hier findest du eine kurze Übersicht über den Server und wichtige Einstiegspunkte.',
              fields,
              timestamp: new Date().toISOString()
            }
          ]
        };
      }
    );

    await interaction.reply({
      content: 'Info-Embed wurde gepostet/aktualisiert.',
      ephemeral: true
    });
  }
};

export default command;

