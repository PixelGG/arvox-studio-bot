import type { Client } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import type { AppConfig } from '../types/config';
import { GithubService } from '../services/GithubService';
import { GiveawayService } from '../services/GiveawayService';

const event: DiscordEvent = {
  name: 'ready',
  once: true,
  async execute(client: Client, config: AppConfig) {
    // eslint-disable-next-line no-console
    console.log(`Logged in as ${client.user?.tag ?? 'Unknown User'}`);

    await GiveawayService.resumeRunningGiveaways(client);
    await GithubService.startPolling(client, config);
  }
};

export default event;
