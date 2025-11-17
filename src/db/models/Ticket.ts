import { Schema, model, type Document } from 'mongoose';

export type TicketStatus = 'open' | 'in_progress' | 'closed';

export interface TicketDocument extends Document {
  id: string;
  guildId: string;
  channelId: string;
  creatorId: string;
  assignedSupportId?: string;
  status: TicketStatus;
  topic?: string;
  tags?: string[];
  createdAt: Date;
  closedAt?: Date;
  transcriptUrl?: string;
}

const TicketSchema = new Schema<TicketDocument>(
  {
    id: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    creatorId: { type: String, required: true },
    assignedSupportId: { type: String },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'closed'],
      default: 'open'
    },
    topic: { type: String },
    tags: [{ type: String }],
    transcriptUrl: { type: String },
    closedAt: { type: Date }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

export const TicketModel = model<TicketDocument>('Ticket', TicketSchema);

