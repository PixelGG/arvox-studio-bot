import { Schema, model, type Document } from 'mongoose';

export interface RepositoryDocument extends Document {
  id: number;
  name: string;
  description?: string;
  url: string;
  lastActivity: Date;
  active: boolean;
}

const RepositorySchema = new Schema<RepositoryDocument>(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    url: { type: String, required: true },
    lastActivity: { type: Date, required: true },
    active: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

export const RepositoryModel = model<RepositoryDocument>('Repository', RepositorySchema);

