import axios from 'axios';
import type { Client } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { AppConfig, GuildConfig } from '../types/config';
import { RepositoryModel } from '../db/models/Repository';
import { PersistentMessageService } from './PersistentMessageService';

export class GithubService {
  static async syncRepositories(client: Client, config: AppConfig): Promise<void> {
    const guildConfig = config.guilds[config.defaultGuildId];
    if (!guildConfig) return;

    const repos = await this.fetchRepos(guildConfig);

    const activeRepoIds = new Set<number>();
    for (const repo of repos) {
      activeRepoIds.add(repo.id);
      await RepositoryModel.findOneAndUpdate(
        { id: repo.id },
        {
          id: repo.id,
          name: repo.name,
          description: repo.description,
          url: repo.html_url,
          lastActivity: new Date(repo.pushed_at ?? repo.updated_at ?? Date.now()),
          active: true
        },
        { upsert: true }
      ).exec();
    }

    await RepositoryModel.updateMany(
      { id: { $nin: Array.from(activeRepoIds) } },
      { $set: { active: false } }
    ).exec();

    await PersistentMessageService.ensurePersistentMessage(
      client,
      guildConfig.id,
      'project_index_main',
      guildConfig.github.channelId,
      async () => {
        const storedRepos = await RepositoryModel.find({ active: true })
          .sort({ lastActivity: -1 })
          .limit(10)
          .exec();

        const embed = new EmbedBuilder()
          .setTitle('Arvox Studio – Projektindex')
          .setDescription(
            'Übersicht der zuletzt aktiven GitHub-Repositories. TODO: Passe die Konfiguration bei Bedarf an.'
          )
          .setTimestamp(new Date());

        if (storedRepos.length === 0) {
          embed.addFields({
            name: 'Keine Repositories gefunden',
            value:
              'Entweder ist die GitHub-Konfiguration fehlerhaft oder es gibt noch keine öffentlichen Repos.'
          });
        } else {
          for (const repo of storedRepos) {
            embed.addFields({
              name: repo.name,
              value: `[Repository öffnen](${repo.url}) – letzte Aktivität <t:${Math.floor(
                repo.lastActivity.getTime() / 1000
              )}:R>`,
              inline: false
            });
          }
        }

        return {
          embeds: [embed]
        };
      }
    );
  }

  static async startPolling(client: Client, config: AppConfig): Promise<void> {
    const guildConfig = config.guilds[config.defaultGuildId];
    if (!guildConfig) return;

    const intervalMinutes = guildConfig.github.pollingIntervalMinutes || 60;
    const intervalMs = intervalMinutes * 60 * 1000;

    // initial sync
    void this.syncRepositories(client, config);

    setInterval(() => {
      void this.syncRepositories(client, config);
    }, intervalMs);
  }

  private static async fetchRepos(
    guildConfig: GuildConfig
  ): Promise<
    {
      id: number;
      name: string;
      description: string | null;
      html_url: string;
      updated_at: string;
      pushed_at: string;
    }[]
  > {
    const username = guildConfig.github.username;
    const url = `https://api.github.com/users/${encodeURIComponent(
      username
    )}/repos?per_page=100&sort=updated`;
    const token = process.env.GITHUB_TOKEN;

    const response = await axios.get(url, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'Arvox-Studio-Bot'
          }
        : {
            'User-Agent': 'Arvox-Studio-Bot'
          }
    });

    const ignored = new Set(guildConfig.github.ignoredRepos.map((name) => name.toLowerCase()));

    return (response.data as any[]).filter((repo) => {
      if (ignored.has((repo.name as string).toLowerCase())) {
        return false;
      }

      if (!guildConfig.github.trackAllPublicRepos) {
        return guildConfig.github.trackedRepos.includes(repo.name);
      }

      return true;
    });
  }
}

