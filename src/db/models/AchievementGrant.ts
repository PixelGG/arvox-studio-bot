import { Schema, model, type Document } from 'mongoose';

export interface AchievementGrantDocument extends Document {
  guildId: string;
  userId: string;
  achievementKey: string;
  grantedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AchievementGrantSchema = new Schema<AchievementGrantDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    achievementKey: { type: String, required: true },
    grantedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

AchievementGrantSchema.index({ guildId: 1, userId: 1, achievementKey: 1 }, { unique: true });

export const AchievementGrantModel = model<AchievementGrantDocument>(
  'AchievementGrant',
  AchievementGrantSchema
);
