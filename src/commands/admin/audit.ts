import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { WarningModel } from '../../db/models/Warning';
import { MuteModel } from '../../db/models/Mute';
import { BanModel } from '../../db/models/Ban';
import { TicketModel } from '../../db/models/Ticket';
import { JoinLeaveModel } from '../../db/models/JoinLeave';
import { XpProfileModel } from '../../db/models/XpProfile';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('audit')
    .setDescription('Audit-Informationen')
    .addSubcommand((sub) =>
      sub
        .setName('user')
        .setDescription('Audit eines Users')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Ziel-User').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('guild').setDescription('Guild-Audit'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Nur im Server nutzbar.', ephemeral: true });
      return;
    }

    if (sub === 'user') {
      const user = interaction.options.getUser('user', true);
      const guildId = interaction.guildId;
      const [warnings, mutes, bans, tickets, joins, leaves, xp] = await Promise.all([
        WarningModel.find({ guildId, userId: user.id }),
        MuteModel.find({ guildId, userId: user.id, active: true }),
        BanModel.find({ guildId, userId: user.id, active: true }),
        TicketModel.find({ guildId, creatorId: user.id }),
        JoinLeaveModel.find({ guildId, userId: user.id, type: 'join' }),
        JoinLeaveModel.find({ guildId, userId: user.id, type: 'leave' }),
        XpProfileModel.findOne({ guildId, userId: user.id })
      ]);

      const embed = new EmbedBuilder()
        .setTitle('Audit User')
        .setDescription(`${user.tag} (${user.id})`)
        .addFields(
          { name: 'Warnings', value: warnings.length.toString(), inline: true },
          { name: 'Mutes (aktiv)', value: mutes.length.toString(), inline: true },
          { name: 'Bans (aktiv)', value: bans.length.toString(), inline: true },
          { name: 'Tickets erstellt', value: tickets.length.toString(), inline: true },
          { name: 'Joins', value: joins.length.toString(), inline: true },
          { name: 'Leaves', value: leaves.length.toString(), inline: true },
          { name: 'XP', value: xp ? `${xp.xp} (Level ${xp.level})` : 'n/a', inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === 'guild') {
      const guildId = interaction.guildId;
      const [warnings, ticketsOpen, ticketsClosed, joinsLast7, leavesLast7] = await Promise.all([
        WarningModel.countDocuments({ guildId }),
        TicketModel.countDocuments({ guildId, status: { $ne: 'closed' } }),
        TicketModel.countDocuments({ guildId, status: 'closed' }),
        JoinLeaveModel.countDocuments({
          guildId,
          type: 'join',
          occurredAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        JoinLeaveModel.countDocuments({
          guildId,
          type: 'leave',
          occurredAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      ]);

      const embed = new EmbedBuilder()
        .setTitle('Audit Guild')
        .addFields(
          { name: 'Warnings', value: `${warnings}`, inline: true },
          { name: 'Tickets offen', value: `${ticketsOpen}`, inline: true },
          { name: 'Tickets geschlossen', value: `${ticketsClosed}`, inline: true },
          { name: 'Joins 7d', value: `${joinsLast7}`, inline: true },
          { name: 'Leaves 7d', value: `${leavesLast7}`, inline: true },
          { name: 'Mitglieder', value: `${interaction.guild?.memberCount ?? 'n/a'}`, inline: true }
        )
        .setTimestamp(new Date());

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;
