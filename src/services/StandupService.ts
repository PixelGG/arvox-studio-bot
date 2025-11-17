import type {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  TextChannel
} from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import type { AppConfig, GuildConfig } from '../types/config';
import { StandupEntryModel } from '../db/models/StandupEntry';

const STANDUP_MODAL_ID = 'standup_modal';

export class StandupService {
  private static getGuildConfig(config: AppConfig, guildId: string): GuildConfig | undefined {
    return config.guilds[guildId];
  }

  static async startStandup(
    interaction: ChatInputCommandInteraction,
    config: AppConfig
  ): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId || !interaction.guild) {
      await interaction.reply({
        content: 'Dieser Command kann nur in einem Server verwendet werden.',
        ephemeral: true
      });
      return;
    }

    const guildConfig = this.getGuildConfig(config, guildId);
    if (!guildConfig) {
      await interaction.reply({
        content: 'Keine Guild-Konfiguration gefunden.',
        ephemeral: true
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(
      guildConfig.standup.channelId
    ) as TextChannel | undefined;
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: 'Standup-Channel ist nicht korrekt konfiguriert.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🔁 Daily Standup')
      .setDescription(
        'Bitte klicke auf den Button und fülle das Standup-Formular aus.\n\nBeantworte kurz:\n1. Was hast du seit dem letzten Standup gemacht?\n2. Was planst du als Nächstes?\n3. Gibt es Blocker?'
      )
      .setTimestamp(new Date());

    const button = new ButtonBuilder()
      .setCustomId('standup_open_modal')
      .setLabel('Standup ausfüllen')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      content: `Standup gestartet in ${channel}.`,
      ephemeral: true
    });
  }

  static async openStandupModal(interaction: any): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(STANDUP_MODAL_ID)
      .setTitle('Daily Standup');

    const yesterday = new TextInputBuilder()
      .setCustomId('standup_yesterday')
      .setLabel('Was hast du seit dem letzten Standup gemacht?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const today = new TextInputBuilder()
      .setCustomId('standup_today')
      .setLabel('Was planst du als Nächstes?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const blockers = new TextInputBuilder()
      .setCustomId('standup_blockers')
      .setLabel('Gibt es Blocker?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(yesterday),
      new ActionRowBuilder<TextInputBuilder>().addComponents(today),
      new ActionRowBuilder<TextInputBuilder>().addComponents(blockers)
    );

    await interaction.showModal(modal);
  }

  static async handleStandupModalSubmit(
    interaction: ModalSubmitInteraction
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Standup-Einträge sind nur in Servern möglich.',
        ephemeral: true
      });
      return;
    }

    const standupDate = new Date();
    const answers = {
      yesterday: interaction.fields.getTextInputValue('standup_yesterday'),
      today: interaction.fields.getTextInputValue('standup_today'),
      blockers: interaction.fields.getTextInputValue('standup_blockers') ?? ''
    };

    await StandupEntryModel.create({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      standupDate,
      answers
    });

    await interaction.reply({
      content: 'Danke! Dein Standup wurde gespeichert.',
      ephemeral: true
    });
  }

  static async showStandupSummary(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Standup-Auswertungen sind nur in Servern möglich.',
        ephemeral: true
      });
      return;
    }

    const dateOption = interaction.options.getString('date');
    const date = dateOption ? new Date(dateOption) : new Date();
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    const entries = await StandupEntryModel.find({
      guildId: interaction.guildId,
      standupDate: { $gte: date, $lt: nextDay }
    }).exec();

    if (entries.length === 0) {
      await interaction.reply({
        content: 'Keine Standup-Einträge für diesen Tag gefunden.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Standup Zusammenfassung')
      .setDescription(`Datum: ${date.toISOString().substring(0, 10)}`)
      .setTimestamp(new Date());

    for (const entry of entries) {
      embed.addFields({
        name: `User ${entry.userId}`,
        value:
          `**Gestern:** ${entry.answers.yesterday}\n` +
          `**Heute:** ${entry.answers.today}\n` +
          (entry.answers.blockers
            ? `**Blocker:** ${entry.answers.blockers}`
            : '**Blocker:** keine angegeben')
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

