import type { MessageReaction, User } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import { StarboardMessageModel } from '../db/models/StarboardMessage';

const STAR_EMOJI = '⭐';
const THRESHOLD = 3;

const event: DiscordEvent = {
  name: 'messageReactionAdd',
  async execute(client, _config, ...args: unknown[]) {
    const [reaction, user] = args as [MessageReaction, User];
    if (!reaction.message.guild || user.bot) return;
    if (reaction.emoji?.name !== STAR_EMOJI) return;

    const guild = reaction.message.guild;
    const guildId = guild.id;

    // Here we could fetch starboard channel/threshold from DB; using defaults for now.
    const starboardChannelId = (guild as any).config?.channels?.info ?? null;
    if (!starboardChannelId) return;

    const count = reaction.count ?? 1;
    if (count < THRESHOLD) return;

    const existing = await StarboardMessageModel.findOne({
      guildId,
      messageId: reaction.message.id
    }).exec();

    if (existing?.starboardMessageId) return; // already posted

    const channel = await guild.channels.fetch(starboardChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const content =
      `⭐ **${count}** | <#${reaction.message.channelId}>\n` +
      `[Zur Nachricht](${reaction.message.url})\n` +
      `${reaction.message.author}: ${reaction.message.content ?? ''}`;

    const posted = await channel.send({ content });

    if (existing) {
      existing.starboardMessageId = posted.id;
      existing.reactionCount = count;
      await existing.save();
    } else {
      await StarboardMessageModel.create({
        guildId,
        channelId: reaction.message.channelId,
        messageId: reaction.message.id,
        starboardChannelId,
        starboardMessageId: posted.id,
        reactionCount: count
      });
    }
  }
};

export default event;
