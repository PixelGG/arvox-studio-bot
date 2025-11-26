import { Schema, model, type Document } from 'mongoose';

export type AutoRoleCondition = 'immediate' | 'after_accept' | 'delayed';

export interface AutoRoleRuleDocument extends Document {
  guildId: string;
  roleId: string;
  condition: AutoRoleCondition;
  delayMinutes?: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AutoRoleRuleSchema = new Schema<AutoRoleRuleDocument>(
  {
    guildId: { type: String, required: true, index: true },
    roleId: { type: String, required: true },
    condition: { type: String, enum: ['immediate', 'after_accept', 'delayed'], default: 'immediate' },
    delayMinutes: { type: Number },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

AutoRoleRuleSchema.index({ guildId: 1, roleId: 1, condition: 1 });

export const AutoRoleRuleModel = model<AutoRoleRuleDocument>('AutoRoleRule', AutoRoleRuleSchema);
