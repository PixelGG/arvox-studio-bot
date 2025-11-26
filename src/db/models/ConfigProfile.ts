import { Schema, model, type Document } from 'mongoose';

export interface ConfigProfileDocument extends Document {
  guildId: string;
  name: string;
  description?: string;
  isActive: boolean;
  snapshot: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ConfigProfileSchema = new Schema<ConfigProfileDocument>(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: false },
    snapshot: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

ConfigProfileSchema.index({ guildId: 1, name: 1 }, { unique: true });

export const ConfigProfileModel = model<ConfigProfileDocument>('ConfigProfile', ConfigProfileSchema);
