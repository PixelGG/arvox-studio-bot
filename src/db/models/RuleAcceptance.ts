import { Schema, model, type Document } from 'mongoose';

export interface RuleAcceptanceDocument extends Document {
  guildId: string;
  userId: string;
  acceptedAt: Date;
  version?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RuleAcceptanceSchema = new Schema<RuleAcceptanceDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    acceptedAt: { type: Date, required: true, default: Date.now },
    version: { type: String }
  },
  { timestamps: true }
);

RuleAcceptanceSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const RuleAcceptanceModel = model<RuleAcceptanceDocument>('RuleAcceptance', RuleAcceptanceSchema);
