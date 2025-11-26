import type { Message } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import type { AppConfig } from '../types/config';
import { LoggingService } from '../services/LoggingService';
import { ModerationService } from '../services/ModerationService';
import { MessageLogModel } from '../db/models/MessageLog';

const bannedPhrases = ['discord.gg/', 'http://', 'https://']; // legacy simple filter

const event: DiscordEvent = {
  name: 'messageCreate',
  async execute(_client, config: AppConfig, ...args: unknown[]) {
    const [message] = args as [Message];
  if (!message.guild || message.author.bot) return;

  // Legacy simple automod
  const contentLower = message.content.toLowerCase();
  const hit = bannedPhrases.find((phrase) => contentLower.includes(phrase));
  if (hit) {
      await LoggingService.logAutomodEvent(
        message.guild,
        config,
        'AutoMod – Verdächtige Nachricht',
        `Nachricht von ${message.author.tag} (${message.author.id}) in ${message.channel} enthält "${hit}".\n\nInhalt:\n${message.content}`
      );
    }

    // Advanced automod rules
    await ModerationService.evaluateAutomod(message);

    // XP gain
    const { XpService } = await import('../services/XpService');
    await XpService.addMessageXp(message.guild.id, message.author.id, 5);

    // Custom commands (!tag)
    const { CustomCommandService } = await import('../services/CustomCommandService');
    await CustomCommandService.executeFromMessage(message);

    // persist message log (basic content only)
    await MessageLogModel.findOneAndUpdate(
      { guildId: message.guild.id, messageId: message.id },
      {
        guildId: message.guild.id,
        channelId: message.channelId,
        messageId: message.id,
        userId: message.author.id,
        content: message.content ?? ''
      },
      { upsert: true }
    ).catch(() => null);
  }
};

export default event;
