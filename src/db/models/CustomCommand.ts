import { Schema, model, type Document } from 'mongoose';

export interface CustomCommandDocument extends Document {
  guildId: string;
  key: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomCommandSchema = new Schema<CustomCommandDocument>(
  {
    guildId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    content: { type: String, required: true },
    createdBy: { type: String, required: true }
  },
  { timestamps: true }
);

CustomCommandSchema.index({ guildId: 1, key: 1 }, { unique: true });

export const CustomCommandModel = model<CustomCommandDocument>('CustomCommand', CustomCommandSchema);
