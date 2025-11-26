import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import { nanoid } from 'nanoid';
import { EventModel } from '../../db/models/Event';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Event-Manager')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Neues Event erstellen')
        .addStringOption((opt) =>
          opt.setName('title').setDescription('Titel').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('in_minutes').setDescription('Start in Minuten').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Beschreibung').setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt.setName('duration').setDescription('Dauer in Minuten').setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt.setName('max_participants').setDescription('Max. Teilnehmer').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Alle Events anzeigen')
    )
    .addSubcommand((sub) =>
      sub.setName('join').setDescription('Event beitreten').addStringOption((opt) =>
        opt.setName('id').setDescription('Event-ID').setRequired(true)
      )
    )
    .addSubcommand((sub) =>
      sub.setName('leave').setDescription('Event verlassen').addStringOption((opt) =>
        opt.setName('id').setDescription('Event-ID').setRequired(true)
      )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: 'Nur im Server nutzbar.', ephemeral: true });
      return;
    }

    if (sub === 'create') {
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description') ?? '';
      const inMinutes = interaction.options.getInteger('in_minutes', true);
      const duration = interaction.options.getInteger('duration') ?? undefined;
      const maxParticipants = interaction.options.getInteger('max_participants') ?? undefined;
      const startsAt = new Date(Date.now() + inMinutes * 60_000);
      const eventId = nanoid(6);

      await EventModel.create({
        guildId: interaction.guildId,
        eventId,
        title,
        description,
        startsAt,
        durationMinutes: duration,
        maxParticipants,
        hostId: interaction.user.id,
        participants: []
      });

      await interaction.reply({
        content: `Event erstellt: ${title} (ID: ${eventId}), Start <t:${Math.floor(
          startsAt.getTime() / 1000
        )}:R>`,
        ephemeral: true
      });
      return;
    }

    if (sub === 'list') {
      const events = await EventModel.find({ guildId: interaction.guildId })
        .sort({ startsAt: 1 })
        .limit(10)
        .exec();
      if (!events.length) {
        await interaction.reply({ content: 'Keine Events geplant.', ephemeral: true });
        return;
      }
      const lines = events.map(
        (ev) =>
          `${ev.eventId}: ${ev.title} | Start <t:${Math.floor(
            ev.startsAt.getTime() / 1000
          )}:R> | Teilnehmer ${ev.participants.length}/${ev.maxParticipants ?? '∞'}`
      );
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
      return;
    }

    const id = interaction.options.getString('id', true);
    const event = await EventModel.findOne({ guildId: interaction.guildId, eventId: id }).exec();
    if (!event) {
      await interaction.reply({ content: 'Event nicht gefunden.', ephemeral: true });
      return;
    }

    if (sub === 'join') {
      if (event.maxParticipants && event.participants.length >= event.maxParticipants) {
        await interaction.reply({ content: 'Event ist voll.', ephemeral: true });
        return;
      }
      if (!event.participants.includes(interaction.user.id)) {
        event.participants.push(interaction.user.id);
        await event.save();
      }
      await interaction.reply({ content: 'Du bist dem Event beigetreten.', ephemeral: true });
      return;
    }

    if (sub === 'leave') {
      event.participants = event.participants.filter((id) => id !== interaction.user.id);
      await event.save();
      await interaction.reply({ content: 'Du hast das Event verlassen.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;
