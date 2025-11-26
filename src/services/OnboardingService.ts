import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction
} from 'discord.js';
import { MemberProfileModel } from '../db/models/MemberProfile';

export const ONBOARDING_MODAL_ID = 'onboarding_modal';

export class OnboardingService {
  static async startFlow(interaction: ChatInputCommandInteraction): Promise<void> {
    const modal = new ModalBuilder().setCustomId(ONBOARDING_MODAL_ID).setTitle('Onboarding');

    const language = new TextInputBuilder()
      .setCustomId('onboarding_language')
      .setLabel('Welche Sprache sprichst du?')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const games = new TextInputBuilder()
      .setCustomId('onboarding_games')
      .setLabel('Welche Spiele spielst du gern?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const interests = new TextInputBuilder()
      .setCustomId('onboarding_interests')
      .setLabel('Interessen / Rollenwünsche')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(language),
      new ActionRowBuilder<TextInputBuilder>().addComponents(games),
      new ActionRowBuilder<TextInputBuilder>().addComponents(interests)
    );

    await interaction.showModal(modal);
  }

  static async handleSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Nur im Server verfügbar.', ephemeral: true });
      return;
    }

    const answers: Record<string, string> = {
      language: interaction.fields.getTextInputValue('onboarding_language') ?? '',
      games: interaction.fields.getTextInputValue('onboarding_games') ?? '',
      interests: interaction.fields.getTextInputValue('onboarding_interests') ?? ''
    };

    await MemberProfileModel.findOneAndUpdate(
      { guildId: interaction.guildId, userId: interaction.user.id },
      { guildId: interaction.guildId, userId: interaction.user.id, answers },
      { upsert: true }
    ).exec();

    await interaction.reply({ content: 'Danke! Dein Onboarding-Profil wurde gespeichert.', ephemeral: true });
  }
}
