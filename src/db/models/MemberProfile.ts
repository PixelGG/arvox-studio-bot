import { Schema, model, type Document } from 'mongoose';

export interface MemberProfileDocument extends Document {
  guildId: string;
  userId: string;
  answers: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const MemberProfileSchema = new Schema<MemberProfileDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    answers: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

MemberProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const MemberProfileModel = model<MemberProfileDocument>('MemberProfile', MemberProfileSchema);
