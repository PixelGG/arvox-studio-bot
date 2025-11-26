import { Schema, model, type Document } from 'mongoose';

export interface StarboardMessageDocument extends Document {
  guildId: string;
  channelId: string;
  messageId: string;
  starboardChannelId: string;
  starboardMessageId?: string;
  reactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const StarboardMessageSchema = new Schema<StarboardMessageDocument>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    starboardChannelId: { type: String, required: true },
    starboardMessageId: { type: String },
    reactionCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

StarboardMessageSchema.index({ guildId: 1, messageId: 1 }, { unique: true });

export const StarboardMessageModel = model<StarboardMessageDocument>(
  'StarboardMessage',
  StarboardMessageSchema
);
