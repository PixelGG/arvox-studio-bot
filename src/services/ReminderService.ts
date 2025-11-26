import { ReminderModel } from '../db/models/Reminder';
import type { Client, TextChannel } from 'discord.js';

export class ReminderService {
  static async createReminder(params: {
    guildId: string;
    userId: string;
    channelId: string;
    message: string;
    remindAt: Date;
  }) {
    return ReminderModel.create({ ...params, delivered: false });
  }

  static async deliverDueReminders(client: Client): Promise<void> {
    const now = new Date();
    const due = await ReminderModel.find({
      delivered: false,
      remindAt: { $lte: now }
    }).limit(50);

    for (const rem of due) {
      const channel = (await client.channels.fetch(rem.channelId).catch(() => null)) as TextChannel | null;
      if (channel && channel.isTextBased()) {
        await channel.send({
          content: `<@${rem.userId}> Erinnerung: ${rem.message}`
        });
      }
      rem.delivered = true;
      await rem.save().catch(() => null);
    }
  }
}
