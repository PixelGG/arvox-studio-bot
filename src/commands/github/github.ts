import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { GithubService } from '../../services/GithubService';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('github')
    .setDescription('GitHub-Integration verwalten')
    .addSubcommand((sub) =>
      sub.setName('sync').setDescription('Projektindex mit GitHub synchronisieren')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  requiredRoleKeys: ['owner', 'admin', 'devLead'],
  async execute(interaction, config) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'sync') {
      await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await GithubService.syncRepositories(interaction.client, config);
    await interaction.editReply('GitHub-Projektindex wurde synchronisiert.');
  }
};

export default command;

