import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import { LoggingService } from '../services/LoggingService';

const event: DiscordEvent = {
  name: 'guildMemberRemove',
  async execute(_client, config, ...args: unknown[]) {
    const [member] = args as [GuildMember | PartialGuildMember];
    const user = 'user' in member ? member.user : null;
    const guild = 'guild' in member ? member.guild : null;
    if (!user || !guild) return;

    await LoggingService.logMemberLeave(user, guild, config);
  }
};

export default event;
