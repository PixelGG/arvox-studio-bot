import type { Client } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import type { AppConfig, GuildConfig } from '../types/config';
import { GithubService } from '../services/GithubService';
import { GiveawayService } from '../services/GiveawayService';
import { RadioService } from '../services/RadioService';
import { PersistentMessageService } from '../services/PersistentMessageService';
import { EmbedDefinitionService } from '../services/EmbedDefinitionService';
import { SchedulerService } from '../services/SchedulerService';
import { ModuleService } from '../services/ModuleService';

const event: DiscordEvent = {
  name: 'clientReady',
  once: true,
  async execute(client: Client, config: AppConfig) {
    // eslint-disable-next-line no-console
    console.log(`Logged in as ${client.user?.tag ?? 'Unknown User'}`);

    await GiveawayService.resumeRunningGiveaways(client);
    await GithubService.startPolling(client, config);
    await RadioService.resumeFromState(client, config);
    await EmbedDefinitionService.syncAll(client);
    await SchedulerService.start(client, config);
    await ModuleService.onReady(client);

    // Ensure radio_status panel is up to date for all guilds on startup
    for (const [guildId, guildConfig] of Object.entries(config.guilds)) {
      const typedGuildConfig = guildConfig as GuildConfig;
      if (!typedGuildConfig.music.enabled) continue;

      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) continue;

      await PersistentMessageService.ensurePersistentMessage(
        client,
        guildId,
        'radio_status',
        typedGuildConfig.channels.info,
        () => {
          const embed = RadioService.getStatusEmbed(guild, config);
          return { embeds: [embed] };
        }
      );
    }
  }
};

export default event;
