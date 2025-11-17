import type { Client } from 'discord.js';
import type { AppConfig } from '../types/config';
import type { DiscordEvent } from '../types/events';
import ready from './ready';
import interactionCreate from './interactionCreate';
import guildMemberAdd from './guildMemberAdd';
import guildMemberRemove from './guildMemberRemove';
import voiceStateUpdate from './voiceStateUpdate';
import messageCreate from './messageCreate';

const events: DiscordEvent[] = [
  ready,
  interactionCreate,
  guildMemberAdd,
  guildMemberRemove,
  voiceStateUpdate,
  messageCreate
];

export async function registerEvents(client: Client, config: AppConfig): Promise<void> {
  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args: unknown[]) =>
        event.execute(client, config, ...(args as never[]))
      );
    } else {
      client.on(event.name, (...args: unknown[]) =>
        event.execute(client, config, ...(args as never[]))
      );
    }
  }
}

