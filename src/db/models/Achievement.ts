import { Schema, model, type Document } from 'mongoose';

export interface AchievementDocument extends Document {
  guildId: string;
  key: string;
  name: string;
  description?: string;
  icon?: string;
  condition?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AchievementSchema = new Schema<AchievementDocument>(
  {
    guildId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    icon: { type: String },
    condition: { type: String }
  },
  { timestamps: true }
);

AchievementSchema.index({ guildId: 1, key: 1 }, { unique: true });

export const AchievementModel = model<AchievementDocument>('Achievement', AchievementSchema);
