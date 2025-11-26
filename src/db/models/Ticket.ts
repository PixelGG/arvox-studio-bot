import { Schema, model, type Document } from 'mongoose';

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'closed';

export interface TicketDocument extends Document {
  id: string;
  guildId: string;
  channelId: string;
  creatorId: string;
  assignedSupportId?: string;
  type?: string;
  notes?: string[];
  participants?: string[];
  status: TicketStatus;
  topic?: string;
  tags?: string[];
  slaMinutes?: number;
  firstResponseAt?: Date;
  createdAt: Date;
  closedAt?: Date;
  transcriptUrl?: string;
  closeReason?: string;
}

const TicketSchema = new Schema<TicketDocument>(
  {
    id: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    creatorId: { type: String, required: true },
    assignedSupportId: { type: String },
    type: { type: String },
    notes: [{ type: String }],
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting', 'closed'],
      default: 'open'
    },
    topic: { type: String },
    tags: [{ type: String }],
    slaMinutes: { type: Number },
    firstResponseAt: { type: Date },
    participants: [{ type: String }],
    transcriptUrl: { type: String },
    closedAt: { type: Date },
    closeReason: { type: String }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

export const TicketModel = model<TicketDocument>('Ticket', TicketSchema);
