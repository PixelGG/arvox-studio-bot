import { Schema, model, type Document } from 'mongoose';

export type MuteType = 'timeout' | 'role';

export interface MuteDocument extends Document {
  guildId: string;
  userId: string;
  moderatorId: string;
  type: MuteType;
  reason?: string;
  startAt: Date;
  endAt?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MuteSchema = new Schema<MuteDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    type: { type: String, enum: ['timeout', 'role'], default: 'timeout' },
    reason: { type: String },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

MuteSchema.index({ guildId: 1, userId: 1, active: 1 });

export const MuteModel = model<MuteDocument>('Mute', MuteSchema);
