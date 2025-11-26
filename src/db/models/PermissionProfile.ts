import { Schema, model, type Document } from 'mongoose';

export interface PermissionProfileDocument extends Document {
  guildId: string;
  profileKey: string;
  label: string;
  roleIds: string[];
  actions: Record<string, string[]>; // moduleKey -> allowedActions[]
  createdAt: Date;
  updatedAt: Date;
}

const PermissionProfileSchema = new Schema<PermissionProfileDocument>(
  {
    guildId: { type: String, required: true, index: true },
    profileKey: { type: String, required: true },
    label: { type: String, required: true },
    roleIds: [{ type: String, required: true }],
    actions: { type: Map, of: [String], default: {} }
  },
  { timestamps: true }
);

PermissionProfileSchema.index({ guildId: 1, profileKey: 1 }, { unique: true });

export const PermissionProfileModel = model<PermissionProfileDocument>(
  'PermissionProfile',
  PermissionProfileSchema
);
