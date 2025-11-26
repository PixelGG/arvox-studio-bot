import { Schema, model, type Document } from 'mongoose';

export interface JobScheduleDocument extends Document {
  key: string;
  description?: string;
  intervalMs: number;
  active: boolean;
  lastRunAt?: Date;
  lastResult?: 'ok' | 'error';
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const JobScheduleSchema = new Schema<JobScheduleDocument>(
  {
    key: { type: String, required: true, unique: true },
    description: { type: String },
    intervalMs: { type: Number, required: true },
    active: { type: Boolean, default: true },
    lastRunAt: { type: Date },
    lastResult: { type: String },
    meta: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const JobScheduleModel = model<JobScheduleDocument>('JobSchedule', JobScheduleSchema);
