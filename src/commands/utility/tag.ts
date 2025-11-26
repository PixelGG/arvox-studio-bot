import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { CustomCommandService } from '../../services/CustomCommandService';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Custom Commands/Tags verwalten')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Tag setzen oder aktualisieren')
        .addStringOption((opt) => opt.setName('key').setDescription('Name').setRequired(true))
        .addStringOption((opt) =>
          opt.setName('content').setDescription('Inhalt/Antwort').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Tag löschen')
        .addStringOption((opt) => opt.setName('key').setDescription('Name').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Nur im Server nutzbar.', ephemeral: true });
      return;
    }

    if (sub === 'set') {
      const key = interaction.options.getString('key', true);
      const content = interaction.options.getString('content', true);
      await CustomCommandService.setCommand(interaction.guildId, key, content, interaction.user.id);
      await interaction.reply({ content: `Tag '${key}' gespeichert.`, ephemeral: true });
      return;
    }

    if (sub === 'delete') {
      const key = interaction.options.getString('key', true);
      await CustomCommandService.deleteCommand(interaction.guildId, key);
      await interaction.reply({ content: `Tag '${key}' gelöscht.`, ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;
