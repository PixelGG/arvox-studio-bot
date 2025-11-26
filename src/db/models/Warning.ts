import { Schema, model, type Document } from 'mongoose';

export type WarningSeverity = 'low' | 'medium' | 'high';

export interface WarningDocument extends Document {
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  severity: WarningSeverity;
  points: number;
  createdAt: Date;
  updatedAt: Date;
}

const WarningSchema = new Schema<WarningDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    points: { type: Number, required: true }
  },
  { timestamps: true }
);

export const WarningModel = model<WarningDocument>('Warning', WarningSchema);
