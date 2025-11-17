import { Schema, model, type Document } from 'mongoose';

export interface RadioStateDocument extends Document {
  guildId: string;
  voiceChannelId: string;
  streamUrl: string;
  isPlaying: boolean;
  volumePercent: number;
  createdAt: Date;
  updatedAt: Date;
}

const RadioStateSchema = new Schema<RadioStateDocument>(
  {
    guildId: { type: String, required: true, unique: true },
    voiceChannelId: { type: String, required: true },
    streamUrl: { type: String, required: true },
    isPlaying: { type: Boolean, default: false },
    volumePercent: { type: Number, default: 100 }
  },
  {
    timestamps: true
  }
);

export const RadioStateModel = model<RadioStateDocument>('RadioState', RadioStateSchema);
