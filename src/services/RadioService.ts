import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
  type AudioPlayer,
  type VoiceConnection,
  type AudioResource
} from '@discordjs/voice';
import axios from 'axios';
import type {
  Client,
  Guild,
  GuildMember,
  VoiceBasedChannel,
  EmbedBuilder
} from 'discord.js';
import { EmbedBuilder as DiscordEmbedBuilder } from 'discord.js';
import type { AppConfig, GuildConfig } from '../types/config';

interface RadioSession {
  guildId: string;
  voiceChannelId: string;
  streamUrl: string;
  startedAt: Date;
  connection: VoiceConnection;
  player: AudioPlayer;
  resource: AudioResource | null;
  volume: number;
}

export class RadioService {
  private static sessions = new Map<string, RadioSession>();

  private static getGuildConfig(config: AppConfig, guildId: string): GuildConfig | undefined {
    return config.guilds[guildId];
  }

  static async start(
    client: Client,
    guildId: string,
    voiceChannelId: string,
    streamUrl: string
  ): Promise<void> {
    const guild = await client.guilds.fetch(guildId);
    const channel = (await guild.channels.fetch(
      voiceChannelId
    )) as VoiceBasedChannel | null;
    if (!channel || !channel.isVoiceBased()) {
      throw new Error('Configured voice channel is not a voice channel.');
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator as any
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    const player = createAudioPlayer();
    connection.subscribe(player);

    const response = await axios.get(streamUrl, { responseType: 'stream' });
    const baseVolume = 1;
    const resource = createAudioResource(response.data, { inlineVolume: true });
    if (resource.volume) {
      resource.volume.setVolume(baseVolume);
    }
    player.play(resource);

    await entersState(player, AudioPlayerStatus.Playing, 30_000);

    const session: RadioSession = {
      guildId: guild.id,
      voiceChannelId: channel.id,
      streamUrl,
      startedAt: new Date(),
      connection,
      player,
      resource,
      volume: baseVolume
    };

    this.sessions.set(guild.id, session);
  }

  static async stop(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) return;

    session.player.stop();
    session.connection.destroy();
    this.sessions.delete(guildId);
  }

  static async setStream(
    client: Client,
    guildId: string,
    streamUrl: string,
    voiceChannelId?: string
  ): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      if (!voiceChannelId) {
        throw new Error('Voice channel id is required when starting the radio.');
      }
      await this.start(client, guildId, voiceChannelId, streamUrl);
      return;
    }

    const response = await axios.get(streamUrl, { responseType: 'stream' });
    const resource = createAudioResource(response.data, { inlineVolume: true });
    if (resource.volume) {
      resource.volume.setVolume(session.volume ?? 1);
    }
    session.player.stop();
    session.player.play(resource);
    session.streamUrl = streamUrl;
    session.startedAt = new Date();
    session.resource = resource;
  }

  static setVolume(guildId: string, volumePercent: number): void {
    const session = this.sessions.get(guildId);
    if (!session || !session.resource || !session.resource.volume) {
      throw new Error('Radio is not currently playing.');
    }

    const clamped = Math.max(0, Math.min(volumePercent, 200));
    const factor = clamped / 100;

    session.volume = factor;
    session.resource.volume.setVolume(factor);
  }

  static getStatusEmbed(
    guild: Guild,
    config: AppConfig
  ): EmbedBuilder {
    const session = this.sessions.get(guild.id);
    const guildConfig = this.getGuildConfig(config, guild.id);

    const embed = new DiscordEmbedBuilder().setTitle('Radio Status').setTimestamp(new Date());

    if (!guildConfig?.music.enabled) {
      embed.setDescription('Radio is disabled in configuration.');
      return embed;
    }

    if (!session) {
      embed.setDescription('Radio is currently stopped.');
      embed.addFields(
        { name: 'Default channel', value: `<#${guildConfig.music.voiceChannelId}>`, inline: true },
        { name: 'Default stream', value: guildConfig.music.streamUrl, inline: true }
      );
      return embed;
    }

    const now = Date.now();
    const uptimeSeconds = Math.floor((now - session.startedAt.getTime()) / 1000);

    const listeners =
      guild.members.cache.filter(
        (member: GuildMember) => member.voice.channelId === session.voiceChannelId
      ).size ?? 0;

    const volumePercent = Math.round((session.volume ?? 1) * 100);

    embed.setDescription('Radio is currently playing.');
    embed.addFields(
      { name: 'Voice channel', value: `<#${session.voiceChannelId}>`, inline: true },
      { name: 'Stream URL', value: session.streamUrl, inline: false },
      {
        name: 'Uptime',
        value: `<t:${Math.floor(session.startedAt.getTime() / 1000)}:R> (${uptimeSeconds} Sekunden)`,
        inline: true
      },
      { name: 'Listeners', value: listeners.toString(), inline: true },
      { name: 'Volume', value: `${volumePercent}%`, inline: true }
    );

    return embed;
  }
}
