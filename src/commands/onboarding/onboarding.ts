import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { OnboardingService } from '../../services/OnboardingService';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('onboarding')
    .setDescription('Onboarding-Flow auslösen')
    .addSubcommand((sub) => sub.setName('start').setDescription('Onboarding-Fragen ausfüllen'))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'start') {
      await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
      return;
    }

    await OnboardingService.startFlow(interaction);
  }
};

export default command;
