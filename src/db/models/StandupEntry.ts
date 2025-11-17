import { Schema, model, type Document } from 'mongoose';

export interface StandupEntryDocument extends Document {
  guildId: string;
  userId: string;
  standupDate: Date;
  answers: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const StandupEntrySchema = new Schema<StandupEntryDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    standupDate: { type: Date, required: true },
    answers: {
      type: Map,
      of: String
    }
  },
  {
    timestamps: true
  }
);

StandupEntrySchema.index({ guildId: 1, userId: 1, standupDate: 1 });

export const StandupEntryModel = model<StandupEntryDocument>(
  'StandupEntry',
  StandupEntrySchema
);

