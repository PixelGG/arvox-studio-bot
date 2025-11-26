import { Schema, model, type Document } from 'mongoose';

export interface ReminderDocument extends Document {
  guildId: string;
  userId: string;
  channelId: string;
  message: string;
  remindAt: Date;
  delivered: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<ReminderDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    channelId: { type: String, required: true },
    message: { type: String, required: true },
    remindAt: { type: Date, required: true },
    delivered: { type: Boolean, default: false }
  },
  { timestamps: true }
);

ReminderSchema.index({ remindAt: 1, delivered: 1 });

export const ReminderModel = model<ReminderDocument>('Reminder', ReminderSchema);
