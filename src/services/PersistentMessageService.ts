import type {
  Client,
  GuildTextBasedChannel,
  Message,
  MessageCreateOptions,
  MessageEditOptions
} from 'discord.js';
import { PersistentMessageModel } from '../db/models/PersistentMessage';

export type RenderMessageFn =
  | (() => MessageCreateOptions | Promise<MessageCreateOptions>)
  | (() => MessageEditOptions | Promise<MessageEditOptions>);

async function fetchTextChannel(
  client: Client,
  guildId: string,
  channelId: string
): Promise<GuildTextBasedChannel | null> {
  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return null;
    }
    return channel as GuildTextBasedChannel;
  } catch {
    return null;
  }
}

export class PersistentMessageService {
  static async ensurePersistentMessage(
    client: Client,
    guildId: string,
    key: string,
    channelId: string,
    renderFn: RenderMessageFn
  ): Promise<Message | null> {
    const existing = await PersistentMessageModel.findOne({ guildId, key }).exec();
    const payload = await renderFn();

    if (existing) {
      const channel = await fetchTextChannel(client, guildId, existing.channelId || channelId);
      if (!channel) {
        return null;
      }

      try {
        const message = await channel.messages.fetch(existing.messageId);
        await message.edit(payload as MessageEditOptions);
        return message;
      } catch {
        const message = await channel.send(payload as MessageCreateOptions);
        existing.messageId = message.id;
        existing.channelId = channel.id;
        await existing.save();
        return message;
      }
    }

    const channel = await fetchTextChannel(client, guildId, channelId);
    if (!channel) {
      return null;
    }

    const message = await channel.send(payload as MessageCreateOptions);

    await PersistentMessageModel.create({
      guildId,
      key,
      channelId: channel.id,
      messageId: message.id
    });

    return message;
  }

  static async updatePersistentMessage(
    client: Client,
    guildId: string,
    key: string,
    renderFn: RenderMessageFn
  ): Promise<Message | null> {
    const existing = await PersistentMessageModel.findOne({ guildId, key }).exec();
    if (!existing) {
      throw new Error(`No persistent message found for guildId=${guildId}, key=${key}`);
    }

    const payload = await renderFn();
    const channel = await fetchTextChannel(client, guildId, existing.channelId);
    if (!channel) {
      return null;
    }

    try {
      const message = await channel.messages.fetch(existing.messageId);
      await message.edit(payload as MessageEditOptions);
      return message;
    } catch {
      const message = await channel.send(payload as MessageCreateOptions);
      existing.messageId = message.id;
      existing.channelId = channel.id;
      await existing.save();
      return message;
    }
  }
}

