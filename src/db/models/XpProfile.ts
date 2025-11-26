import { Schema, model, type Document } from 'mongoose';

export interface XpProfileDocument extends Document {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  messageCount: number;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const XpProfileSchema = new Schema<XpProfileDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date }
  },
  { timestamps: true }
);

XpProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const XpProfileModel = model<XpProfileDocument>('XpProfile', XpProfileSchema);
