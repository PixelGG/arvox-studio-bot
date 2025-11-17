import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import type { RESTPutAPIApplicationGuildCommandsResult } from 'discord-api-types/v10';
import type { AppConfig } from '../types/config';
import type { SlashCommand } from '../types/commands';

export class CommandDeployer {
  private readonly rest: REST;

  constructor(private readonly config: AppConfig) {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      throw new Error('DISCORD_TOKEN is required to deploy commands.');
    }

    this.rest = new REST({ version: '10' }).setToken(token);
  }

  async registerGuildCommands(commands: SlashCommand[]): Promise<RESTPutAPIApplicationGuildCommandsResult> {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = this.config.defaultGuildId;

    if (!clientId) {
      throw new Error('DISCORD_CLIENT_ID is required to deploy commands.');
    }

    const body = commands.map((c) => c.data.toJSON());
    return this.rest.put(Routes.applicationGuildCommands(clientId, guildId), { body }) as Promise<
      RESTPutAPIApplicationGuildCommandsResult
    >;
  }
}
