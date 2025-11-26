import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';
import { PersistentMessageService } from '../../services/PersistentMessageService';
import { RuleAcceptanceModel } from '../../db/models/RuleAcceptance';
import { AutoRoleRuleModel } from '../../db/models/AutoRoleRule';
import { LoggingService } from '../../services/LoggingService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Regelsystem verwalten')
    .addSubcommand((sub) =>
      sub
        .setName('post')
        .setDescription('Regel-Embed als persistente Nachricht posten/aktualisieren')
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
      'rules_main',
      guildConfig.rules.channelId,
      () => {
        const embeds = guildConfig.rules.sections
          .sort((a, b) => a.order - b.order)
          .map((section, index) => ({
            title: `${index + 1}. ${section.title}`,
            description: section.description
          }));

        const button = new ButtonBuilder()
          .setCustomId('rules_accept')
          .setLabel('Regeln akzeptieren')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

        return {
          embeds,
          components: [row]
        };
      }
    );

    await interaction.reply({
      content: 'Regel-Embed wurde gepostet/aktualisiert.',
      ephemeral: true
    });
  }
};

export default command;
