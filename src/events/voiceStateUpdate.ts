import type { VoiceState } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import type { AppConfig, GuildConfig } from '../types/config';
import { SupportQueueService } from '../services/SupportQueueService';
import { LoggingService } from '../services/LoggingService';
import { PersistentMessageService } from '../services/PersistentMessageService';

function getGuildConfig(config: AppConfig, guildId: string): GuildConfig | undefined {
  return config.guilds[guildId];
}

const event: DiscordEvent = {
  name: 'voiceStateUpdate',
  async execute(client, config, ...args: unknown[]) {
    const [oldState, newState] = args as [VoiceState, VoiceState];
    if (!newState.guild) return;
    const guildId = newState.guild.id;
    const guildConfig = getGuildConfig(config, guildId);
    if (!guildConfig || !guildConfig.supportQueue.enabled) return;

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
        newState.guild,
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
        const member = await newState.guild.members.fetch(next.userId).catch(() => null);
        if (member && member.voice.channelId === queueChannelId) {
          await member.voice.setChannel(newState.channel);

          await LoggingService.logSupportEvent(
            newState.guild,
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
};

export default event;
