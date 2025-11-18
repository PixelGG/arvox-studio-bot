import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  type TextChannel
} from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Öffentliche Ankündigungen im Announcements-Channel erstellen')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Eine Ankündigung erstellen')
        .addStringOption((opt) =>
          opt.setName('title').setDescription('Titel der Ankündigung').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('message').setDescription('Inhalt der Ankündigung').setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('ping_role')
            .setDescription('Optionale Rolle zum Pingen (z. B. Nova Updates, Events)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('image_url')
            .setDescription('Optionales Bild für das Embed')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('thumbnail_url')
            .setDescription('Optionales Thumbnail für das Embed')
            .setRequired(false)
        )
        // bis zu 3 optionale Felder
        .addStringOption((opt) =>
          opt
            .setName('field1_name')
            .setDescription('Titel für Feld 1')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('field1_value')
            .setDescription('Inhalt für Feld 1')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('field2_name')
            .setDescription('Titel für Feld 2')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('field2_value')
            .setDescription('Inhalt für Feld 2')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('field3_name')
            .setDescription('Titel für Feld 3')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('field3_value')
            .setDescription('Inhalt für Feld 3')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  requiredRoleKeys: ['owner', 'admin', 'devLead'],
  async execute(interaction, config: AppConfig) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'create') {
      await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
      return;
    }

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

    const title = interaction.options.getString('title', true);
    const message = interaction.options.getString('message', true);
    const pingRole = interaction.options.getRole('ping_role');
    const imageUrl = interaction.options.getString('image_url') ?? undefined;
    const thumbnailUrl = interaction.options.getString('thumbnail_url') ?? undefined;

    const channel = interaction.guild.channels.cache.get(
      guildConfig.channels.announcements
    ) as TextChannel | undefined;

    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: 'Announcements-Channel ist nicht korrekt konfiguriert.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xf97316) // orange Akzent für öffentliche Ankündigungen
      .setTitle(title)
      .setDescription(message)
      .setAuthor({
        name: interaction.guild.name,
        iconURL: interaction.guild.iconURL({ size: 128 }) ?? undefined
      })
      .setFooter({ text: `Von ${interaction.user.tag}` })
      .setTimestamp(new Date());

    if (imageUrl) {
      embed.setImage(imageUrl);
    }
    if (thumbnailUrl) {
      embed.setThumbnail(thumbnailUrl);
    }

    // optionale Felder sammeln
    const fields: { name: string; value: string; inline?: boolean }[] = [];
    for (let i = 1; i <= 3; i += 1) {
      const nameOpt = interaction.options.getString(`field${i}_name`);
      const valueOpt = interaction.options.getString(`field${i}_value`);
      if (nameOpt && valueOpt) {
        fields.push({ name: nameOpt, value: valueOpt, inline: false });
      }
    }
    if (fields.length > 0) {
      embed.addFields(fields);
    }

    const content = pingRole ? `<@&${pingRole.id}>` : undefined;

    await channel.send({ content, embeds: [embed] });

    await interaction.reply({
      content: `Ankündigung wurde in ${channel} veröffentlicht.`,
      ephemeral: true
    });
  }
};

export default command;

