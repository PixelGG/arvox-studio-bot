import { Schema, model, type Document } from 'mongoose';

export interface EmbedDefinitionDocument extends Document {
  guildId: string;
  key: string;
  channelId: string;
  embedPayload: Record<string, unknown>;
  components?: Record<string, unknown>[]; // raw component payloads
  updatedAt: Date;
  createdAt: Date;
}

const EmbedDefinitionSchema = new Schema<EmbedDefinitionDocument>(
  {
    guildId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    channelId: { type: String, required: true },
    embedPayload: { type: Schema.Types.Mixed, required: true },
    components: { type: [Schema.Types.Mixed] }
  },
  {
    timestamps: true
  }
);

EmbedDefinitionSchema.index({ guildId: 1, key: 1 }, { unique: true });

export const EmbedDefinitionModel = model<EmbedDefinitionDocument>(
  'EmbedDefinition',
  EmbedDefinitionSchema
);
