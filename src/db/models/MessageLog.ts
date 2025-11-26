import { Schema, model, type Document } from 'mongoose';

export interface MessageLogDocument extends Document {
  guildId: string;
  channelId: string;
  messageId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageLogSchema = new Schema<MessageLogDocument>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    userId: { type: String, required: true },
    content: { type: String, default: '' }
  },
  { timestamps: true }
);

MessageLogSchema.index({ guildId: 1, messageId: 1 }, { unique: true });

export const MessageLogModel = model<MessageLogDocument>('MessageLog', MessageLogSchema);
