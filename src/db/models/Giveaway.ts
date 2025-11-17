import { Schema, model, type Document } from 'mongoose';

export type GiveawayStatus = 'running' | 'ended';

export interface GiveawayDocument extends Document {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  winnerCount: number;
  hostId: string;
  status: GiveawayStatus;
  endAt: Date;
  participants: string[];
}

const GiveawaySchema = new Schema<GiveawayDocument>(
  {
    id: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    prize: { type: String, required: true },
    winnerCount: { type: Number, required: true },
    hostId: { type: String, required: true },
    status: {
      type: String,
      enum: ['running', 'ended'],
      default: 'running'
    },
    endAt: { type: Date, required: true },
    participants: [{ type: String }]
  },
  {
    timestamps: true
  }
);

export const GiveawayModel = model<GiveawayDocument>('Giveaway', GiveawaySchema);

