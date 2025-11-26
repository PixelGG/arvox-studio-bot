import { Schema, model, type Document } from 'mongoose';

export type JoinLeaveType = 'join' | 'leave';

export interface JoinLeaveDocument extends Document {
  guildId: string;
  userId: string;
  type: JoinLeaveType;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JoinLeaveSchema = new Schema<JoinLeaveDocument>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ['join', 'leave'], required: true },
    occurredAt: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);

JoinLeaveSchema.index({ guildId: 1, occurredAt: 1 });

export const JoinLeaveModel = model<JoinLeaveDocument>('JoinLeave', JoinLeaveSchema);
