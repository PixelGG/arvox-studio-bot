import type { Client, MessageCreateOptions } from 'discord.js';
import { EmbedDefinitionModel, type EmbedDefinitionDocument } from '../db/models/EmbedDefinition';
import { PersistentMessageService } from './PersistentMessageService';

export class EmbedDefinitionService {
  static async getDefinition(
    guildId: string,
    key: string
  ): Promise<EmbedDefinitionDocument | null> {
    return EmbedDefinitionModel.findOne({ guildId, key }).exec();
  }

  static async upsertDefinition(params: {
    guildId: string;
    key: string;
    channelId: string;
    embedPayload: Record<string, unknown>;
    components?: Record<string, unknown>[];
  }): Promise<EmbedDefinitionDocument> {
    const { guildId, key, channelId, embedPayload, components } = params;

    const doc = await EmbedDefinitionModel.findOneAndUpdate(
      { guildId, key },
      {
        guildId,
        key,
        channelId,
        embedPayload,
        components: components ?? []
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    return doc;
  }

  static async syncDefinition(
    client: Client,
    guildId: string,
    key: string
  ): Promise<void> {
    const def = await this.getDefinition(guildId, key);
    if (!def) return;

    await PersistentMessageService.ensurePersistentMessage(
      client,
      guildId,
      key,
      def.channelId,
      () => this.buildMessagePayload(def)
    );
  }

  static async syncAll(client: Client): Promise<void> {
    const defs = await EmbedDefinitionModel.find({}).exec();
    for (const def of defs) {
      await PersistentMessageService.ensurePersistentMessage(
        client,
        def.guildId,
        def.key,
        def.channelId,
        () => this.buildMessagePayload(def)
      );
    }
  }

  private static buildMessagePayload(def: EmbedDefinitionDocument): MessageCreateOptions {
    const payload: MessageCreateOptions = {};

    // Allow either a single embed or a full message payload in embedPayload
    if (Array.isArray((def.embedPayload as any).embeds)) {
      payload.embeds = (def.embedPayload as any).embeds;
    } else {
      payload.embeds = [def.embedPayload];
    }

    if (def.components && def.components.length > 0) {
      payload.components = def.components as any;
    }

    if ((def.embedPayload as any).content) {
      payload.content = (def.embedPayload as any).content as string;
    }

    return payload;
  }
}
