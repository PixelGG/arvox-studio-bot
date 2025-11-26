import { Schema, model, type Document } from 'mongoose';

export type AutomodRuleType = 'badword' | 'invite' | 'caps' | 'emote' | 'repeat' | 'link';
export type AutomodAction = 'warn' | 'mute' | 'delete' | 'tempban' | 'ban';

export interface AutomodRuleDocument extends Document {
  guildId: string;
  name: string;
  type: AutomodRuleType;
  pattern?: string;
  threshold?: number;
  windowSeconds?: number;
  action: AutomodAction;
  points?: number;
  durationMinutes?: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AutomodRuleSchema = new Schema<AutomodRuleDocument>(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['badword', 'invite', 'caps', 'emote', 'repeat', 'link'], required: true },
    pattern: { type: String },
    threshold: { type: Number, default: 1 },
    windowSeconds: { type: Number, default: 10 },
    action: { type: String, enum: ['warn', 'mute', 'delete', 'tempban', 'ban'], required: true },
    points: { type: Number, default: 1 },
    durationMinutes: { type: Number },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

AutomodRuleSchema.index({ guildId: 1, name: 1 }, { unique: true });

export const AutomodRuleModel = model<AutomodRuleDocument>('AutomodRule', AutomodRuleSchema);
