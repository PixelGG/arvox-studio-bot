import { Schema, model, type Document } from 'mongoose';

export type FeedType = 'twitch' | 'youtube' | 'x' | 'rss' | 'github';

export interface FeedDocument extends Document {
  guildId: string;
  type: FeedType;
  source: string;
  channelId: string;
  filter?: string;
  lastItemId?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FeedSchema = new Schema<FeedDocument>(
  {
    guildId: { type: String, required: true, index: true },
    type: { type: String, enum: ['twitch', 'youtube', 'x', 'rss', 'github'], required: true },
    source: { type: String, required: true },
    channelId: { type: String, required: true },
    filter: { type: String },
    lastItemId: { type: String },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

FeedSchema.index({ guildId: 1, type: 1, source: 1 }, { unique: true });

export const FeedModel = model<FeedDocument>('Feed', FeedSchema);
