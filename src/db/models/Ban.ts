import { Schema, model, type Document } from 'mongoose';

export type BanType = 'ban' | 'tempban' | 'softban';

export interface BanDocument extends Document {
  guildId: string;
  userId: string;
  moderatorId: string;
  reason?: string;
  type: BanType;
  startAt: Date;
  endAt?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BanSchema = new Schema<BanDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    reason: { type: String },
    type: { type: String, enum: ['ban', 'tempban', 'softban'], default: 'ban' },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

BanSchema.index({ guildId: 1, userId: 1, active: 1 });

export const BanModel = model<BanDocument>('Ban', BanSchema);
