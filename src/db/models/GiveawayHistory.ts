import { Schema, model, type Document } from 'mongoose';

export interface GiveawayHistoryDocument extends Document {
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  winnerCount: number;
  winners: string[];
  participants: number;
  endedAt: Date;
  action: 'end' | 'reroll';
  createdAt: Date;
  updatedAt: Date;
}

const GiveawayHistorySchema = new Schema<GiveawayHistoryDocument>(
  {
    giveawayId: { type: String, required: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    prize: { type: String, required: true },
    winnerCount: { type: Number, required: true },
    winners: { type: [String], default: [] },
    participants: { type: Number, default: 0 },
    endedAt: { type: Date, required: true },
    action: { type: String, enum: ['end', 'reroll'], default: 'end' }
  },
  { timestamps: true }
);

export const GiveawayHistoryModel = model<GiveawayHistoryDocument>(
  'GiveawayHistory',
  GiveawayHistorySchema
);
