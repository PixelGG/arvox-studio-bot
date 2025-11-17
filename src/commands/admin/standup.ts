import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { StandupService } from '../../services/StandupService';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('standup')
    .setDescription('Daily Standup verwalten')
    .addSubcommand((sub) =>
      sub.setName('start').setDescription('Neues Standup im konfigurierten Channel starten')
    )
    .addSubcommand((sub) =>
      sub
        .setName('summary')
        .setDescription('Standup-Zusammenfassung für einen Tag anzeigen')
        .addStringOption((opt) =>
          opt
            .setName('date')
            .setDescription('Datum im Format YYYY-MM-DD (optional, default: heute)')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  requiredRoleKeys: ['owner', 'admin', 'devLead'],
  async execute(interaction, config) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      await StandupService.startStandup(interaction, config);
      return;
    }

    if (sub === 'summary') {
      await StandupService.showStandupSummary(interaction);
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;

