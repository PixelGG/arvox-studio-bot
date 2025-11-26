import type { MessageReaction, User } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import { StarboardMessageModel } from '../db/models/StarboardMessage';

const STAR_EMOJI = '⭐';
const THRESHOLD = 3;

const event: DiscordEvent = {
  name: 'messageReactionRemove',
  async execute(_client, _config, ...args: unknown[]) {
    const [reaction, user] = args as [MessageReaction, User];
    if (!reaction.message.guild || user.bot) return;
    if (reaction.emoji?.name !== STAR_EMOJI) return;

    const count = reaction.count ?? 0;
    if (count >= THRESHOLD) return;

    // Below threshold, we allow removal handling (e.g., could remove from starboard), skipping for simplicity
  }
};

export default event;
