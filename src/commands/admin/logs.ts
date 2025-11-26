import { PermissionFlagsBits, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { MessageLogModel } from '../../db/models/MessageLog';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Message-Logs durchsuchen/exportieren')
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('Suche in Message-Logs (einfacher Substring)')
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Suchstring').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('export')
        .setDescription('Exportiere letzte N Nachrichten als Text')
        .addIntegerOption((opt) =>
          opt.setName('count').setDescription('Anzahl').setMinValue(10).setMaxValue(500).setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Nur im Server nutzbar.', ephemeral: true });
      return;
    }

    if (sub === 'search') {
      const query = interaction.options.getString('query', true);
      const results = await MessageLogModel.find({
        guildId: interaction.guildId,
        content: { $regex: query, $options: 'i' }
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .exec();

      if (!results.length) {
        await interaction.reply({ content: 'Keine Treffer.', ephemeral: true });
        return;
      }

      const lines = results.map(
        (r) => `<#${r.channelId}> [${r.createdAt.toISOString()}] ${r.userId}: ${r.content.slice(0, 190)}`
      );
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
      return;
    }

    if (sub === 'export') {
      const count = interaction.options.getInteger('count', true);
      const logs = await MessageLogModel.find({ guildId: interaction.guildId })
        .sort({ createdAt: -1 })
        .limit(count)
        .exec();

      const text = logs
        .map(
          (r) =>
            `${r.createdAt.toISOString()} | channel:${r.channelId} | user:${r.userId} | ${r.content}`
        )
        .join('\n');

      const attachment = new AttachmentBuilder(Buffer.from(text, 'utf8'), {
        name: `logs-${interaction.guildId}.txt`
      });

      await interaction.reply({ files: [attachment], ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;
