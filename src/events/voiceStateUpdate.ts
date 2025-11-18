import type { VoiceState, VoiceBasedChannel } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import type { AppConfig, GuildConfig } from '../types/config';
import { SupportQueueService } from '../services/SupportQueueService';
import { LoggingService } from '../services/LoggingService';
import { PersistentMessageService } from '../services/PersistentMessageService';
import { RadioService } from '../services/RadioService';
import { RadioStateModel } from '../db/models/RadioState';

function getGuildConfig(config: AppConfig, guildId: string): GuildConfig | undefined {
  return config.guilds[guildId];
}

const event: DiscordEvent = {
  name: 'voiceStateUpdate',
  async execute(client, config, ...args: unknown[]) {
    const [oldState, newState] = args as [VoiceState, VoiceState];
    const guild = newState.guild ?? oldState.guild;
    if (!guild) return;

    const guildId = guild.id;
    const guildConfig = getGuildConfig(config, guildId);
    if (!guildConfig) return;

    // --- Voice Support Queue ---
    if (guildConfig.supportQueue.enabled) {
      const queueChannelId = guildConfig.supportQueue.queueVoiceChannelId;
      const supportVoiceChannelIds = new Set(guildConfig.supportQueue.supportVoiceChannelIds);

      // User joined support queue
      if (
        newState.channelId === queueChannelId &&
        oldState.channelId !== queueChannelId &&
        newState.member
      ) {
        SupportQueueService.addToQueue(guildId, newState.member.id);

        try {
          await newState.member.send(
            'Du wurdest in die Support-Warteschlange aufgenommen. Bitte warte, bis ein Supporter dich in einen Voice-Channel zieht.'
          );
        } catch {
          // ignore DM errors
        }

        await LoggingService.logSupportEvent(
          guild,
          config,
          'Support-Queue',
          `${newState.member.user.tag} wurde zur Support-Warteschlange hinzugefügt.`
        );
      }

      // User left support queue
      if (
        oldState.channelId === queueChannelId &&
        newState.channelId !== queueChannelId &&
        oldState.member
      ) {
        SupportQueueService.removeFromQueue(guildId, oldState.member.id);
      }

      // Supporter joined support voice channel -> move next user from queue
      if (
        newState.channel &&
        supportVoiceChannelIds.has(newState.channel.id) &&
        newState.member &&
        !newState.member.user.bot
      ) {
        const next = SupportQueueService.popNext(guildId);
        if (next) {
          const member = await guild.members.fetch(next.userId).catch(() => null);
          if (member && member.voice.channelId === queueChannelId) {
            await member.voice.setChannel(newState.channel);

            await LoggingService.logSupportEvent(
              guild,
              config,
              'Support-Queue Match',
              `${member.user.tag} wurde zu ${newState.member.user.tag} in ${newState.channel} verschoben.`
            );
          }
        }
      }

      // Persistente Queue-Status-Nachricht aktualisieren
      if (guildConfig.supportQueue.statusMessageChannelId) {
        const queue = SupportQueueService.getQueue(guildId);
        await PersistentMessageService.ensurePersistentMessage(
          client,
          guildId,
          'support_queue_status',
          guildConfig.supportQueue.statusMessageChannelId,
          () => {
            const description =
              queue.length === 0
                ? 'Aktuell wartet niemand in der Support-Warteschlange.'
                : queue
                    .map(
                      (entry, index) =>
                        `${index + 1}. <@${entry.userId}> – seit <t:${Math.floor(
                          entry.joinedAt.getTime() / 1000
                        )}:R>`
                    )
                    .join('\n');

            return {
              embeds: [
                {
                  title: 'Voice-Support Warteschlange',
                  description,
                  timestamp: new Date().toISOString()
                }
              ]
            };
          }
        );
      }
    }

    // --- Radio: auto join/leave based on listeners ---
    if (guildConfig.music.enabled) {
      const musicChannelId = guildConfig.music.voiceChannelId;

      // If a non-bot user joins the music channel and radio is enabled but not connected yet, start it.
      if (
        newState.channelId === musicChannelId &&
        newState.member &&
        !newState.member.user.bot
      ) {
        const existingSession = RadioService.getSession(guildId);
        if (!existingSession) {
          const state = await RadioStateModel.findOne({
            guildId,
            isPlaying: true
          }).exec();

          if (state) {
            try {
              await RadioService.start(
                client,
                state.guildId,
                state.voiceChannelId,
                state.streamUrl,
                state.volumePercent
              );
            } catch {
              // ignore start errors here; staff can inspect via /radio status
            }
          }
        }
      }

      // If last non-bot listener leaves the music channel, disconnect radio but keep state.
      if (oldState.channelId === musicChannelId || newState.channelId === musicChannelId) {
        const channel =
          (guild.channels.cache.get(musicChannelId) as VoiceBasedChannel | undefined) ??
          ((await guild.channels.fetch(musicChannelId)) as VoiceBasedChannel | null);

        if (channel && channel.isVoiceBased()) {
          const nonBotListeners = channel.members.filter((m) => !m.user.bot).size;
          const session = RadioService.getSession(guildId);

          if (session && nonBotListeners === 0) {
            try {
              RadioService.disconnectGuild(guildId);
            } catch {
              // ignore disconnect errors
            }
          }
        }
      }
    }
  }
};

export default event;

