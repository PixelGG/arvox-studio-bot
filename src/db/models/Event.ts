import { Schema, model, type Document } from 'mongoose';

export interface EventDocument extends Document {
  guildId: string;
  eventId: string;
  title: string;
  description?: string;
  startsAt: Date;
  durationMinutes?: number;
  maxParticipants?: number;
  hostId: string;
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<EventDocument>(
  {
    guildId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number },
    maxParticipants: { type: Number },
    hostId: { type: String, required: true },
    participants: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const EventModel = model<EventDocument>('Event', EventSchema);
