import { XpProfileModel } from '../db/models/XpProfile';

export class XpService {
  private static cooldown = new Map<string, number>();

  static async addMessageXp(guildId: string, userId: string, amount = 5): Promise<void> {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const cooldownMs = 60 * 1000;
    const last = this.cooldown.get(key) ?? 0;
    if (now - last < cooldownMs) return;
    this.cooldown.set(key, now);

    const doc = await XpProfileModel.findOneAndUpdate(
      { guildId, userId },
      { $inc: { xp: amount, messageCount: 1 }, $set: { lastMessageAt: new Date() } },
      { upsert: true, new: true }
    ).exec();

    const required = this.getRequiredXpForLevel(doc.level + 1);
    if (doc.xp >= required) {
      doc.level += 1;
      await doc.save().catch(() => null);
    }
  }

  static getRequiredXpForLevel(level: number): number {
    // simple curve
    return Math.floor(100 + Math.pow(level, 2) * 20);
  }
}
