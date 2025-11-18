import { randomBytes } from 'node:crypto';

export interface EmbedSession {
  code: string;
  guildId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
}

export class EmbedSessionService {
  private static sessions = new Map<string, EmbedSession>();

  static createSession(guildId: string, userId: string, ttlMinutes = 60): EmbedSession {
    const code = randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

    const session: EmbedSession = {
      code,
      guildId,
      createdBy: userId,
      createdAt: now,
      expiresAt
    };

    this.sessions.set(code, session);
    return session;
  }

  static getSession(code: string): EmbedSession | undefined {
    const session = this.sessions.get(code);
    if (!session) return undefined;
    if (session.expiresAt.getTime() < Date.now()) {
      this.sessions.delete(code);
      return undefined;
    }
    return session;
  }

  static consumeSession(code: string): EmbedSession | undefined {
    const session = this.getSession(code);
    if (session) {
      this.sessions.delete(code);
    }
    return session;
  }
}

