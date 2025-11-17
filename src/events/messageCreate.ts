import type { Message } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import type { AppConfig } from '../types/config';
import { LoggingService } from '../services/LoggingService';

const bannedPhrases = ['discord.gg/', 'http://', 'https://']; // TODO: optional in Config auslagern

const event: DiscordEvent = {
  name: 'messageCreate',
  async execute(_client, config: AppConfig, ...args: unknown[]) {
    const [message] = args as [Message];
    if (!message.guild || message.author.bot) return;

    const contentLower = message.content.toLowerCase();
    const hit = bannedPhrases.find((phrase) => contentLower.includes(phrase));
    if (!hit) return;

    await LoggingService.logAutomodEvent(
      message.guild,
      config,
      'AutoMod – Verdächtige Nachricht',
      `Nachricht von ${message.author.tag} (${message.author.id}) in ${message.channel} enthält "${hit}".\n\nInhalt:\n${message.content}`
    );
  }
};

export default event;
