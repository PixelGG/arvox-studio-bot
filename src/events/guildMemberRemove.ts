import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import { LoggingService } from '../services/LoggingService';
import { JoinLeaveModel } from '../db/models/JoinLeave';

const event: DiscordEvent = {
  name: 'guildMemberRemove',
  async execute(_client, config, ...args: unknown[]) {
    const [member] = args as [GuildMember | PartialGuildMember];
    const user = 'user' in member ? member.user : null;
    const guild = 'guild' in member ? member.guild : null;
    if (!user || !guild) return;

    await LoggingService.logMemberLeave(user, guild, config);
    await JoinLeaveModel.create({
      guildId: guild.id,
      userId: user.id,
      type: 'leave',
      occurredAt: new Date()
    }).catch(() => null);
  }
};

export default event;
