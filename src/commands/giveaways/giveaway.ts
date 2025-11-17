import { PermissionFlagsBits, SlashCommandBuilder, ChannelType } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { GiveawayService } from '../../services/GiveawayService';
import { PersistentMessageService } from '../../services/PersistentMessageService';
import type { AppConfig, GuildConfig } from '../../types/config';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaways erstellen und verwalten')
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Erklärendes Giveaway-Info-Panel posten/aktualisieren')
    )
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Neues Giveaway erstellen')
        .addStringOption((opt) =>
          opt.setName('prize').setDescription('Preis des Giveaways').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('winners')
            .setDescription('Anzahl der Gewinner')
            .setMinValue(1)
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('duration_minutes')
            .setDescription('Dauer in Minuten')
            .setMinValue(1)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel für das Giveaway (optional)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('Ein laufendes Giveaway beenden')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('Giveaway-ID')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Neuen Gewinner für ein beendetes Giveaway ziehen')
        .addStringOption((opt) =>
          opt
            .setName('id')
            .setDescription('Giveaway-ID')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  requiredRoleKeys: ['owner', 'admin', 'devLead'],
  async execute(interaction, config) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
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

      await PersistentMessageService.ensurePersistentMessage(
        interaction.client,
        guildId,
        'giveaway_panel',
        guildConfig.channels.giveaways,
        () => ({
          embeds: [
            {
              title: 'Giveaways – Infos',
              description:
                'In diesem Channel werden regelmäßig Giveaways gestartet. Klicke auf den Teilnehmen-Button unter einem Giveaway, um mitzumachen.',
              fields: [
                {
                  name: 'Ablauf',
                  value:
                    '• Nutze `/giveaway create`, um ein neues Giveaway zu starten (nur Staff).\n' +
                    '• Nutzer klicken auf **Teilnehmen**, um aufgenommen zu werden.\n' +
                    '• Nach Ende werden Gewinner automatisch gezogen und bekanntgegeben.'
                }
              ],
              timestamp: new Date().toISOString()
            }
          ]
        })
      );

      await interaction.reply({
        content: 'Giveaway-Info-Panel wurde gepostet/aktualisiert.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'create') {
      await GiveawayService.createGiveaway(interaction, config);
      return;
    }

    if (sub === 'end') {
      await GiveawayService.endGiveawayByCommand(interaction);
      return;
    }

    if (sub === 'reroll') {
      await GiveawayService.reroll(interaction);
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;

