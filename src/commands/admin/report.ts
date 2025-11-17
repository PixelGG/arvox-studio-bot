import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder, type TextChannel } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('User melden und an die Mod-Queue senden')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Zu meldender User').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Grund der Meldung').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('message_link')
        .setDescription('Optionaler Link zur betreffenden Nachricht')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  guildOnly: true,
  async execute(interaction, config: AppConfig) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: 'Dieser Command kann nur in einem Server verwendet werden.',
        ephemeral: true
      });
      return;
    }

    const guildConfig = getGuildConfig(config, interaction.guildId);
    if (!guildConfig) {
      await interaction.reply({
        content: 'Keine Guild-Konfiguration gefunden.',
        ephemeral: true
      });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const messageLink = interaction.options.getString('message_link') ?? 'Keine Angabe';

    const channel = interaction.guild.channels.cache.get(
      guildConfig.channels.modQueue
    ) as TextChannel | undefined;
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: 'Mod-Queue-Channel ist nicht korrekt konfiguriert.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Neue Meldung')
      .addFields(
        { name: 'Gemeldeter User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
        { name: 'Melder', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
        { name: 'Grund', value: reason, inline: false },
        { name: 'Nachrichtenlink', value: messageLink, inline: false }
      )
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });

    await interaction.reply({
      content: 'Danke, deine Meldung wurde an das Moderationsteam weitergeleitet.',
      ephemeral: true
    });
  }
};

export default command;

