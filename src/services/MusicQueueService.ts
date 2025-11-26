import { nanoid } from 'nanoid';

export interface Track {
  id: string;
  title: string;
  url: string;
  requestedBy: string;
}

export class MusicQueueService {
  private static queues = new Map<string, Track[]>();
  private static current = new Map<string, Track | null>();

  static enqueue(guildId: string, track: Omit<Track, 'id'>): Track {
    const full: Track = { ...track, id: nanoid(6) };
    const queue = this.queues.get(guildId) ?? [];
    queue.push(full);
    this.queues.set(guildId, queue);
    return full;
  }

  static next(guildId: string): Track | null {
    const queue = this.queues.get(guildId) ?? [];
    const next = queue.shift() ?? null;
    this.queues.set(guildId, queue);
    this.current.set(guildId, next);
    return next;
  }

  static getCurrent(guildId: string): Track | null {
    return this.current.get(guildId) ?? null;
  }

  static getQueue(guildId: string): Track[] {
    return [...(this.queues.get(guildId) ?? [])];
  }

  static clear(guildId: string): void {
    this.queues.set(guildId, []);
    this.current.set(guildId, null);
  }
}
