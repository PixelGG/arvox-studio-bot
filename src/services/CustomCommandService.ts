import { CustomCommandModel } from '../db/models/CustomCommand';
import type { ChatInputCommandInteraction, Message } from 'discord.js';

export class CustomCommandService {
  static async setCommand(
    guildId: string,
    key: string,
    content: string,
    createdBy: string
  ) {
    return CustomCommandModel.findOneAndUpdate(
      { guildId, key },
      { guildId, key, content, createdBy },
      { upsert: true, new: true }
    ).exec();
  }

  static async deleteCommand(guildId: string, key: string) {
    await CustomCommandModel.deleteOne({ guildId, key }).exec();
  }

  static async executeFromMessage(message: Message) {
    const guildId = message.guildId;
    if (!guildId) return;
    if (!message.content.startsWith('!')) return;
    const key = message.content.slice(1).split(' ')[0];
    if (!key) return;

    const cmd = await CustomCommandModel.findOne({ guildId, key }).exec();
    if (!cmd) return;

    const content = cmd.content
      .replace('{user}', `<@${message.author.id}>`)
      .replace('{channel}', `<#${message.channelId}>`)
      .replace('{guild}', message.guild?.name ?? '')
      .replace('{time}', new Date().toLocaleString());

    await message.reply({ content });
  }
}
