import type { Client, ClientEvents } from 'discord.js';
import type { AppConfig } from './config';

export interface DiscordEvent {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (client: Client, config: AppConfig, ...args: unknown[]) => Promise<void> | void;
}
