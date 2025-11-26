import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember
} from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { ModerationService } from '../../services/ModerationService';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderationsaktionen')
    .addSubcommand((sub) =>
      sub
        .setName('warn')
        .setDescription('User verwarnen')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Ziel-User').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('severity')
            .setDescription('Schwere')
            .addChoices(
              { name: 'low', value: 'low' },
              { name: 'medium', value: 'medium' },
              { name: 'high', value: 'high' }
            )
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('points').setDescription('Punkte').setMinValue(1).setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('reason').setDescription('Grund').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('mute')
        .setDescription('User muten (Timeout)')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Ziel-User').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('minutes')
            .setDescription('Dauer in Minuten')
            .setMinValue(1)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('reason').setDescription('Grund').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('unmute')
        .setDescription('User entmuten')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Ziel-User').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ban')
        .setDescription('User bannen')
        .addUserOption((opt) => opt.setName('user').setDescription('Ziel-User').setRequired(true))
        .addStringOption((opt) =>
          opt.setName('reason').setDescription('Grund').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('tempban')
        .setDescription('User temporär bannen')
        .addUserOption((opt) => opt.setName('user').setDescription('Ziel-User').setRequired(true))
        .addIntegerOption((opt) =>
          opt
            .setName('minutes')
            .setDescription('Dauer in Minuten')
            .setMinValue(1)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('reason').setDescription('Grund').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('unban')
        .setDescription('User entbannen')
        .addStringOption((opt) =>
          opt.setName('userid').setDescription('User-ID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('slowmode')
        .setDescription('Slowmode für Channel setzen')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('Slowmode in Sekunden (0 = aus)')
            .setMinValue(0)
            .setMaxValue(21600)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('lockdown')
        .setDescription('Channel für @everyone sperren')
    )
    .addSubcommand((sub) =>
      sub
        .setName('unlock')
        .setDescription('Channel wieder freigeben')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  guildOnly: true,
  requiredRoleKeys: ['moderator', 'admin', 'owner', 'devLead', 'support'],
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: 'Nur im Server verfügbar.', ephemeral: true });
      return;
    }

    const member = interaction.member as GuildMember;

    if (sub === 'warn') {
      const user = interaction.options.getUser('user', true);
      const target = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!target) {
        await interaction.reply({ content: 'User nicht gefunden.', ephemeral: true });
        return;
      }
      const severity = interaction.options.getString('severity', true) as any;
      const points = interaction.options.getInteger('points', true);
      const reason = interaction.options.getString('reason', true);
      await ModerationService.warn(
        interaction as any,
        target,
        severity,
        reason,
        points
      );
      await interaction.reply({ content: 'Warnung vergeben.', ephemeral: true });
      return;
    }

    if (sub === 'mute') {
      const user = interaction.options.getUser('user', true);
      const target = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!target) {
        await interaction.reply({ content: 'User nicht gefunden.', ephemeral: true });
        return;
      }
      const minutes = interaction.options.getInteger('minutes', true);
      const reason = interaction.options.getString('reason') ?? undefined;
      const result = await ModerationService.mute(member, target, 'timeout', minutes, reason);
      await interaction.reply({
        content: result.ok ? 'User gemutet.' : result.message ?? 'Mute fehlgeschlagen.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'unmute') {
      const user = interaction.options.getUser('user', true);
      const target = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!target) {
        await interaction.reply({ content: 'User nicht gefunden.', ephemeral: true });
        return;
      }
      await ModerationService.unmute(member, target, 'Manuell entmutet');
      await interaction.reply({ content: 'User entmutet.', ephemeral: true });
      return;
    }

    if (sub === 'ban') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') ?? undefined;
      const result = await ModerationService.ban(member, user.id, 'ban', undefined, reason);
      await interaction.reply({
        content: result.ok ? 'User gebannt.' : result.message ?? 'Ban fehlgeschlagen.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'tempban') {
      const user = interaction.options.getUser('user', true);
      const minutes = interaction.options.getInteger('minutes', true);
      const reason = interaction.options.getString('reason') ?? undefined;
      const result = await ModerationService.ban(member, user.id, 'tempban', minutes, reason);
      await interaction.reply({
        content: result.ok ? 'User temporär gebannt.' : result.message ?? 'Tempban fehlgeschlagen.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'unban') {
      const userId = interaction.options.getString('userid', true);
      await ModerationService.unban(member, userId, 'Manuell entbannt');
      await interaction.reply({ content: 'User entbannt.', ephemeral: true });
      return;
    }

    if (sub === 'slowmode') {
      const seconds = interaction.options.getInteger('seconds', true);
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || !('setRateLimitPerUser' in channel)) {
        await interaction.reply({ content: 'In Textkanälen verwenden.', ephemeral: true });
        return;
      }
      await (channel as any).setRateLimitPerUser(
        seconds,
        `Slowmode gesetzt von ${interaction.user.tag}`
      );
      await interaction.reply({
        content: `Slowmode auf ${seconds}s gesetzt.`,
        ephemeral: true
      });
      return;
    }

    if (sub === 'lockdown') {
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || !('permissionOverwrites' in channel)) {
        await interaction.reply({ content: 'In Textkanälen verwenden.', ephemeral: true });
        return;
      }
      await (channel as any).permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      });
      await interaction.reply({ content: 'Channel gesperrt.', ephemeral: true });
      return;
    }

    if (sub === 'unlock') {
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || !('permissionOverwrites' in channel)) {
        await interaction.reply({ content: 'In Textkanälen verwenden.', ephemeral: true });
        return;
      }
      await (channel as any).permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null
      });
      await interaction.reply({ content: 'Channel entsperrt.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;
