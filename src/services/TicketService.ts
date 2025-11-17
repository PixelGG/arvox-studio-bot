import fs from 'node:fs';
import path from 'node:path';
import type {
  ChatInputCommandInteraction,
  GuildMember,
  TextChannel,
  ButtonInteraction,
  Role,
  User
} from 'discord.js';
import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildTextBasedChannel
} from 'discord.js';
import { nanoid } from 'nanoid';
import type { AppConfig, GuildConfig } from '../types/config';
import { TicketModel, type TicketDocument } from '../db/models/Ticket';
import { LoggingService } from './LoggingService';

export class TicketService {
  private static getGuildConfig(config: AppConfig, guildId: string): GuildConfig | undefined {
    return config.guilds[guildId];
  }

  static async createTicketFromButton(
    interaction: ButtonInteraction,
    config: AppConfig
  ): Promise<void> {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: 'Tickets können nur in Servern erstellt werden.',
        ephemeral: true
      });
      return;
    }

    const guildConfig = this.getGuildConfig(config, interaction.guildId);
    if (!guildConfig) {
      await interaction.reply({
        content: 'Keine Guild-Konfiguration gefunden.',
        ephemeral: true
      });
      return;
    }

    const topic = 'Allgemeines Support-Ticket';
    const ticket = await this.createTicketChannel(
      interaction.member as GuildMember,
      interaction.user,
      interaction.guild.channels.cache.get(guildConfig.tickets.categoryId) ?? null,
      guildConfig
    );

    await interaction.reply({
      content: ticket
        ? `Ticket erstellt: <#${ticket.channelId}>`
        : 'Beim Erstellen des Tickets ist ein Fehler aufgetreten.',
      ephemeral: true
    });
  }

  static async createTicketFromCommand(
    interaction: ChatInputCommandInteraction,
    config: AppConfig
  ): Promise<void> {
    if (!interaction.guildId || !interaction.guild || !interaction.member) {
      await interaction.reply({
        content: 'Tickets können nur in Servern erstellt werden.',
        ephemeral: true
      });
      return;
    }

    const guildConfig = this.getGuildConfig(config, interaction.guildId);
    if (!guildConfig) {
      await interaction.reply({
        content: 'Keine Guild-Konfiguration gefunden.',
        ephemeral: true
      });
      return;
    }

    const topic = interaction.options.getString('topic') ?? 'Allgemeines Support-Ticket';
    const ticket = await this.createTicketChannel(
      interaction.member as GuildMember,
      interaction.user,
      interaction.guild.channels.cache.get(guildConfig.tickets.categoryId) ?? null,
      guildConfig,
      topic
    );

    await interaction.reply({
      content: ticket
        ? `Ticket erstellt: <#${ticket.channelId}>`
        : 'Beim Erstellen des Tickets ist ein Fehler aufgetreten.',
      ephemeral: true
    });
  }

  private static async createTicketChannel(
    member: GuildMember,
    user: User,
    category: any,
    guildConfig: GuildConfig,
    topic?: string
  ): Promise<TicketDocument | null> {
    const guild = member.guild;
    const shortId = nanoid(6);
    const channelName = `ticket-${member.user.username.toLowerCase()}-${shortId}`;

    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      },
      {
        id: guildConfig.roles.support,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      },
      {
        id: guildConfig.roles.admin,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      }
    ];

    const channel = (await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category?.id,
      permissionOverwrites
    })) as TextChannel;

    const id = nanoid(10);
    const ticketDoc = await TicketModel.create({
      id,
      guildId: guild.id,
      channelId: channel.id,
      creatorId: user.id,
      status: 'open',
      topic
    });

    const embed = new EmbedBuilder()
      .setTitle(`Ticket #${id}`)
      .setDescription(
        'Willkommen im Support-Ticket! Bitte beschreibe dein Anliegen so detailliert wie möglich.'
      )
      .addFields(
        { name: 'Erstellt von', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Status', value: 'Offen', inline: true }
      )
      .setTimestamp(new Date());

    await channel.send({ content: `<@${user.id}> <@&${guildConfig.roles.support}>`, embeds: [embed] });

    await LoggingService.logSupportEvent(
      guild,
      { defaultGuildId: guildConfig.id, guilds: { [guildConfig.id]: guildConfig } },
      'Ticket eröffnet',
      `Ticket #${id} von ${user.tag} (${user.id}) in ${channel}.`
    );

    return ticketDoc;
  }

  static async claimTicket(
    interaction: ChatInputCommandInteraction,
    config: AppConfig
  ): Promise<void> {
    if (!interaction.guildId || !interaction.guild || !interaction.channelId) {
      await interaction.reply({ content: 'Nur in Ticket-Channels verwendbar.', ephemeral: true });
      return;
    }

    const ticket = await TicketModel.findOne({
      guildId: interaction.guildId,
      channelId: interaction.channelId
    }).exec();

    if (!ticket) {
      await interaction.reply({ content: 'Dieses Channel ist kein Ticket.', ephemeral: true });
      return;
    }

    ticket.assignedSupportId = interaction.user.id;
    ticket.status = 'in_progress';
    await ticket.save();

    await interaction.reply({
      content: `Ticket übernommen von <@${interaction.user.id}>.`,
      ephemeral: false
    });
  }

  static async addParticipant(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: 'Nur in Ticket-Channels verwendbar.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role') as Role | null;

    const overwrites: { id: string; allow: bigint[] }[] = [];
    if (user) {
      overwrites.push({
        id: user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      });
    }
    if (role) {
      overwrites.push({
        id: role.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      });
    }

    const channel = interaction.channel as TextChannel;
    for (const overwrite of overwrites) {
      await channel.permissionOverwrites.edit(overwrite.id, {
        ViewChannel: true,
        SendMessages: true
      });
    }

    await interaction.reply({
      content: 'Teilnehmer wurden zum Ticket hinzugefügt.',
      ephemeral: true
    });
  }

  static async removeParticipant(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: 'Nur in Ticket-Channels verwendbar.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role') as Role | null;

    const channel = interaction.channel as TextChannel;

    if (user) {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: false,
        SendMessages: false
      });
    }
    if (role) {
      await channel.permissionOverwrites.edit(role.id, {
        ViewChannel: false,
        SendMessages: false
      });
    }

    await interaction.reply({
      content: 'Teilnehmer wurden aus dem Ticket entfernt.',
      ephemeral: true
    });
  }

  static async closeTicket(
    interaction: ChatInputCommandInteraction,
    config: AppConfig
  ): Promise<void> {
    if (!interaction.guildId || !interaction.guild || !interaction.channelId || !interaction.channel) {
      await interaction.reply({
        content: 'Dieser Command kann nur innerhalb eines Ticket-Channels genutzt werden.',
        ephemeral: true
      });
      return;
    }

    const ticket = await TicketModel.findOne({
      guildId: interaction.guildId,
      channelId: interaction.channelId
    }).exec();

    if (!ticket) {
      await interaction.reply({ content: 'Dieses Channel ist kein Ticket.', ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') ?? 'Kein Grund angegeben';
    const guildConfig = this.getGuildConfig(config, interaction.guildId);

    const transcriptHtml = await this.generateTranscriptHtml(
      interaction.channel as TextChannel,
      ticket
    );

    const filename = `ticket-${ticket.id}.html`;
    const buffer = Buffer.from(transcriptHtml, 'utf8');

    const embed = new EmbedBuilder()
      .setTitle(`Ticket #${ticket.id} geschlossen`)
      .addFields(
        { name: 'Ersteller', value: `<@${ticket.creatorId}>`, inline: true },
        {
          name: 'Bearbeiter',
          value: `<@${interaction.user.id}>`,
          inline: true
        },
        { name: 'Grund', value: reason, inline: false }
      )
      .setTimestamp(new Date());

    const transcriptUrl = guildConfig
      ? await LoggingService.logTicketArchive(interaction.guild, config, {
          embed,
          fileBuffer: buffer,
          filename
        })
      : null;

    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.transcriptUrl = transcriptUrl ?? undefined;
    await ticket.save();

    await interaction.reply({
      content: 'Ticket wird geschlossen. Vielen Dank!',
      ephemeral: true
    });

    await interaction.channel.delete('Ticket geschlossen');
  }

  private static async generateTranscriptHtml(
    channel: TextChannel,
    ticket: TicketDocument
  ): Promise<string> {
    const messages = await this.fetchAllMessages(channel);
    const rows = messages
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map((msg) => {
        const time = new Date(msg.createdTimestamp).toISOString();
        const author = `${msg.author.tag} (${msg.author.id})`;
        const content = msg.cleanContent || '[kein Text]';
        const attachments = msg.attachments
          .map((att) => `<a href="${att.url}">${att.name}</a>`)
          .join(', ');

        return `<tr>
  <td>${time}</td>
  <td>${author}</td>
  <td>${content}</td>
  <td>${attachments}</td>
</tr>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <title>Ticket ${ticket.id} Transcript</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 1rem; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; vertical-align: top; }
      th { background: #f5f5f5; }
      tr:nth-child(even) { background: #fafafa; }
    </style>
  </head>
  <body>
    <h1>Ticket ${ticket.id} Transcript</h1>
    <p>Guild: ${channel.guild.name} (${channel.guild.id})</p>
    <p>Channel: #${channel.name} (${channel.id})</p>
    <table>
      <thead>
        <tr>
          <th>Zeit</th>
          <th>Autor</th>
          <th>Nachricht</th>
          <th>Attachments</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </body>
</html>`;
  }

  private static async fetchAllMessages(channel: TextChannel) {
    const messages = [];
    let lastId: string | undefined;

    while (true) {
      const fetched = await channel.messages.fetch({
        limit: 100,
        ...(lastId ? { before: lastId } : {})
      });

      if (fetched.size === 0) break;

      messages.push(...fetched.values());
      lastId = fetched.last()?.id;

      if (!lastId) break;
    }

    return messages;
  }
}
