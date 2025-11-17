import {
  EmbedBuilder,
  type Guild,
  type GuildMember,
  type TextChannel,
  type User
} from 'discord.js';
import type { AppConfig, GuildConfig } from '../types/config';

function getGuildConfig(config: AppConfig, guildId: string): GuildConfig | undefined {
  return config.guilds[guildId];
}

async function fetchLogChannel(
  guild: Guild,
  channelId: string | undefined
): Promise<TextChannel | null> {
  if (!channelId) return null;
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel as TextChannel;
  } catch {
    return null;
  }
}

export class LoggingService {
  static async logMemberJoin(member: GuildMember, config: AppConfig): Promise<void> {
    const guildConfig = getGuildConfig(config, member.guild.id);
    if (!guildConfig) return;

    const channel = await fetchLogChannel(
      member.guild,
      guildConfig.logging.joinLeaveChannelId
    );
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('Member joined')
      .setDescription(`${member.user} joined the server.`)
      .addFields(
        { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
        {
          name: 'Account created',
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true
        }
      )
      .setThumbnail(member.displayAvatarURL())
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
  }

  static async logMemberLeave(user: User, guild: Guild, config: AppConfig): Promise<void> {
    const guildConfig = getGuildConfig(config, guild.id);
    if (!guildConfig) return;

    const channel = await fetchLogChannel(
      guild,
      guildConfig.logging.joinLeaveChannelId
    );
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('Member left')
      .setDescription(`${user.tag} left the server.`)
      .addFields({ name: 'User', value: `${user.tag} (${user.id})`, inline: true })
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
  }

  static async logSupportEvent(
    guild: Guild,
    config: AppConfig,
    title: string,
    description: string
  ): Promise<void> {
    const guildConfig = getGuildConfig(config, guild.id);
    if (!guildConfig) return;

    const channel = await fetchLogChannel(
      guild,
      guildConfig.logging.supportLogChannelId
    );
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
  }

  static async logAutomodEvent(
    guild: Guild,
    config: AppConfig,
    title: string,
    description: string
  ): Promise<void> {
    const guildConfig = getGuildConfig(config, guild.id);
    if (!guildConfig) return;

    const channel = await fetchLogChannel(
      guild,
      guildConfig.logging.automodChannelId
    );
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
  }

  static async logAuditEvent(
    guild: Guild,
    config: AppConfig,
    title: string,
    description: string
  ): Promise<void> {
    const guildConfig = getGuildConfig(config, guild.id);
    if (!guildConfig) return;

    const channel = await fetchLogChannel(guild, guildConfig.logging.auditChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
  }

  static async logTicketArchive(
    guild: Guild,
    config: AppConfig,
    options: {
      embed: EmbedBuilder;
      fileBuffer: Buffer;
      filename: string;
    }
  ): Promise<string | null> {
    const guildConfig = getGuildConfig(config, guild.id);
    if (!guildConfig) return null;

    const channel = await fetchLogChannel(
      guild,
      guildConfig.logging.ticketArchiveChannelId
    );
    if (!channel) return null;

    const message = await channel.send({
      embeds: [options.embed],
      files: [{ attachment: options.fileBuffer, name: options.filename }]
    });

    const attachment = message.attachments.first();
    return attachment?.url ?? null;
  }
}

