import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { nanoid } from 'nanoid';
import { ReminderService } from '../../services/ReminderService';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Geplante Auto-Announcements')
    .addSubcommand((sub) =>
      sub
        .setName('at')
        .setDescription('ANN in X Minuten in diesem Channel')
        .addIntegerOption((opt) =>
          opt.setName('minutes').setDescription('In Minuten').setMinValue(1).setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('text').setDescription('Nachricht').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'at') {
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
      message: `[Announcement] ${text}`,
      remindAt
    });

    await interaction.reply({
      content: `Announcement geplant für <t:${Math.floor(remindAt.getTime() / 1000)}:R>.`,
      ephemeral: true
    });
  }
};

export default command;
