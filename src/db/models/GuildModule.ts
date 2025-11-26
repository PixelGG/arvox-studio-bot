import { Schema, model, type Document } from 'mongoose';

export type ModuleHealthStatus = 'ok' | 'warning' | 'error' | 'disabled';

export interface GuildModuleDocument extends Document {
  guildId: string;
  moduleKey: string;
  enabled: boolean;
  settings?: Record<string, unknown>;
  healthStatus: ModuleHealthStatus;
  healthMessage?: string;
  lastCheckedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GuildModuleSchema = new Schema<GuildModuleDocument>(
  {
    guildId: { type: String, required: true, index: true },
    moduleKey: { type: String, required: true, index: true },
    enabled: { type: Boolean, default: true },
    settings: { type: Schema.Types.Mixed },
    healthStatus: { type: String, default: 'ok' },
    healthMessage: { type: String },
    lastCheckedAt: { type: Date }
  },
  { timestamps: true }
);

GuildModuleSchema.index({ guildId: 1, moduleKey: 1 }, { unique: true });

export const GuildModuleModel = model<GuildModuleDocument>('GuildModule', GuildModuleSchema);
