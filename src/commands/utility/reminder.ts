import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { ReminderService } from '../../services/ReminderService';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Erinnerungen setzen')
    .addSubcommand((sub) =>
      sub
        .setName('in')
        .setDescription('Erinnerung in X Minuten')
        .addIntegerOption((opt) =>
          opt.setName('minutes').setDescription('In Minuten').setMinValue(1).setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('text').setDescription('Nachricht').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'in') {
      await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
      return;
    }
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({ content: 'Nur im Server nutzbar.', ephemeral: true });
      return;
    }

    const minutes = interaction.options.getInteger('minutes', true);
    const text = interaction.options.getString('text', true);
    const remindAt = new Date(Date.now() + minutes * 60_000);

    await ReminderService.createReminder({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      channelId: interaction.channelId,
      message: text,
      remindAt
    });

    await interaction.reply({
      content: `Reminder erstellt für <t:${Math.floor(remindAt.getTime() / 1000)}:R>.`,
      ephemeral: true
    });
  }
};

export default command;
