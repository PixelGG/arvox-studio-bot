import { Schema, model, type Document } from 'mongoose';

export interface PersistentMessageDocument extends Document {
  guildId: string;
  key: string;
  channelId: string;
  messageId: string;
  meta?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const PersistentMessageSchema = new Schema<PersistentMessageDocument>(
  {
    guildId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    meta: { type: Schema.Types.Mixed }
  },
  {
    timestamps: true
  }
);

PersistentMessageSchema.index({ guildId: 1, key: 1 }, { unique: true });

export const PersistentMessageModel = model<PersistentMessageDocument>(
  'PersistentMessage',
  PersistentMessageSchema
);

