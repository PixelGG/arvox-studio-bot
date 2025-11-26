import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type TextChannel
} from 'discord.js';
import type { AppConfig, GuildConfig } from '../types/config';
import { JobScheduleModel, type JobScheduleDocument } from '../db/models/JobSchedule';
import { PersistentMessageService } from './PersistentMessageService';
import { RadioService } from './RadioService';
import { GithubService } from './GithubService';
import { TicketModel } from '../db/models/Ticket';

type JobHandler = (client: Client, config: AppConfig) => Promise<void>;

interface JobDefinition {
  key: string;
  description: string;
  intervalMs: number;
  handler: JobHandler;
}

export class SchedulerService {
  private static timers = new Map<string, NodeJS.Timeout>();

  static async start(client: Client, config: AppConfig): Promise<void> {
    const defaults = this.getDefaultJobs(config);
    await this.ensureJobDocuments(defaults);

    const jobs = await JobScheduleModel.find({ active: true }).exec();

    const handlers = this.buildHandlerMap(config);

    for (const job of jobs) {
      const handler = handlers[job.key];
      if (!handler) {
        continue;
      }

      const run = async () => {
        try {
          await handler(client, config);
          job.lastRunAt = new Date();
          job.lastResult = 'ok';
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`[Scheduler] Job ${job.key} failed:`, error);
          job.lastRunAt = new Date();
          job.lastResult = 'error';
        } finally {
          await job.save().catch(() => undefined);
        }
      };

      // run once immediately
      void run();

      const timer = setInterval(() => {
        void run();
      }, job.intervalMs);

      this.timers.set(job.key, timer);
    }
  }

  static stopAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  private static async ensureJobDocuments(defaults: JobDefinition[]): Promise<void> {
    for (const job of defaults) {
      await JobScheduleModel.findOneAndUpdate(
        { key: job.key },
        {
          key: job.key,
          description: job.description,
          intervalMs: job.intervalMs,
          active: true
        },
        { upsert: true }
      ).exec();
    }
  }

  private static getDefaultJobs(config: AppConfig): JobDefinition[] {
    const fallbackPollMinutes =
      config.guilds[config.defaultGuildId]?.github.pollingIntervalMinutes || 60;

    return [
      {
        key: 'radio_status_refresh',
        description: 'Aktualisiert das Radio-Status-Panel',
        intervalMs: 5 * 60 * 1000,
        handler: async (client, cfg) => {
          for (const [guildId, guildConfig] of Object.entries(cfg.guilds)) {
            if (!guildConfig.music.enabled) continue;
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (!guild) continue;

            await PersistentMessageService.ensurePersistentMessage(
              client,
              guildId,
              'radio_status',
              guildConfig.channels.info,
              () => {
                const embed = RadioService.getStatusEmbed(guild, cfg);
                return { embeds: [embed] };
              }
            );
          }
        }
      },
      {
        key: 'github_sync_fallback',
        description: 'Fallback-Polling fuer GitHub, falls Webhooks fehlen',
        intervalMs: fallbackPollMinutes * 60 * 1000,
        handler: async (client, cfg) => {
          await GithubService.syncRepositories(client, cfg);
        }
      },
      {
        key: 'standup_daily',
        description: 'Taegliches Standup-Posting im Standup-Channel',
        intervalMs: 24 * 60 * 60 * 1000,
        handler: async (client, cfg) => {
          for (const guildConfig of Object.values(cfg.guilds)) {
            await this.postStandupPrompt(client, guildConfig);
          }
        }
      },
      {
        key: 'cleanup_stale_tickets',
        description: 'Schliesst alte Tickets automatisch',
        intervalMs: 6 * 60 * 60 * 1000,
        handler: async (_client, cfg) => {
          const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const stale = await TicketModel.find({
            status: { $in: ['open', 'in_progress', 'waiting'] },
            createdAt: { $lte: threshold }
          }).exec();
          for (const ticket of stale) {
            ticket.status = 'closed';
            ticket.closedAt = new Date();
            ticket.closeReason = 'Auto-Cleanup nach 30 Tagen';
            await ticket.save().catch(() => undefined);
          }
        }
      },
      {
        key: 'reminder_delivery',
        description: 'Lieferung fälliger Reminder',
        intervalMs: 60 * 1000,
        handler: async (client) => {
          const { ReminderService } = await import('./ReminderService');
          await ReminderService.deliverDueReminders(client);
        }
      }
    ];
  }

  private static buildHandlerMap(_config: AppConfig): Record<string, JobHandler> {
    const defaults = this.getDefaultJobs(_config);
    const map: Record<string, JobHandler> = {};
    for (const def of defaults) {
      map[def.key] = def.handler;
    }
    return map;
  }

  private static async postStandupPrompt(
    client: Client,
    guildConfig: GuildConfig
  ): Promise<void> {
    const guild = await client.guilds.fetch(guildConfig.id).catch(() => null);
    if (!guild) return;

    const channel = guild.channels.cache.get(
      guildConfig.standup.channelId
    ) as TextChannel | undefined;
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('\u231b Daily Standup')
      .setDescription(
        'Bitte klicke auf den Button und fuelle das Standup-Formular aus.\n\n' +
          '1. Was hast du seit dem letzten Standup gemacht?\n' +
          '2. Was planst du als Naechstes?\n' +
          '3. Gibt es Blocker?'
      )
      .setTimestamp(new Date());

    const button = new ButtonBuilder()
      .setCustomId('standup_open_modal')
      .setLabel('Standup ausfuellen')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    await channel.send({ embeds: [embed], components: [row] });
  }
}
