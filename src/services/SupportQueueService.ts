export interface SupportQueueEntry {
  guildId: string;
  userId: string;
  joinedAt: Date;
}

export class SupportQueueService {
  private static queues = new Map<string, SupportQueueEntry[]>();

  static addToQueue(guildId: string, userId: string): void {
    const queue = this.queues.get(guildId) ?? [];
    if (!queue.find((entry) => entry.userId === userId)) {
      queue.push({ guildId, userId, joinedAt: new Date() });
      this.queues.set(guildId, queue);
    }
  }

  static removeFromQueue(guildId: string, userId: string): void {
    const queue = this.queues.get(guildId) ?? [];
    const updated = queue.filter((entry) => entry.userId !== userId);
    this.queues.set(guildId, updated);
  }

  static popNext(guildId: string): SupportQueueEntry | undefined {
    const queue = this.queues.get(guildId) ?? [];
    const entry = queue.shift();
    this.queues.set(guildId, queue);
    return entry;
  }

  static getQueue(guildId: string): SupportQueueEntry[] {
    return [...(this.queues.get(guildId) ?? [])];
  }

  static clearQueue(guildId: string): void {
    this.queues.set(guildId, []);
  }
}

