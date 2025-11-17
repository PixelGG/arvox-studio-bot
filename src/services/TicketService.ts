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
    const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const messageItems = sorted
      .map((msg) => {
        const timeIso = new Date(msg.createdTimestamp).toISOString();
        const timeDisplay = new Date(msg.createdTimestamp).toLocaleString('de-DE');
        const authorTag = TicketService.escapeHtml(msg.author.tag);
        const authorId = msg.author.id;
        const contentRaw = msg.cleanContent || '[kein Text]';
        const content = TicketService.escapeHtml(contentRaw).replace(/\n/g, '<br />');
        const avatarUrl = msg.author.displayAvatarURL({ size: 64 });

        const attachmentsHtml =
          msg.attachments.size > 0
            ? `<div class="attachments">
      ${Array.from(msg.attachments.values())
        .map(
          (att) =>
            `<a href="${att.url}" class="attachment-link">${TicketService.escapeHtml(
              att.name ?? 'Attachment'
            )}</a>`
        )
        .join('<br />')}
    </div>`
            : '';

        return `<article class="message">
  <header class="message-header">
    <img class="avatar" src="${avatarUrl}" alt="${authorTag} Avatar" />
    <div class="author-block">
      <div class="author-tag">${authorTag}</div>
      <div class="author-id">${authorId}</div>
    </div>
    <time class="timestamp" datetime="${timeIso}">${timeDisplay}</time>
  </header>
  <div class="message-content">${content}</div>
  ${attachmentsHtml}
</article>`;
      })
      .join('\n');

    const createdAt = ticket.createdAt ? new Date(ticket.createdAt) : null;
    const closedAt = ticket.closedAt ? new Date(ticket.closedAt) : null;
    const durationMs =
      createdAt && closedAt ? closedAt.getTime() - createdAt.getTime() : undefined;
    const durationMinutes =
      durationMs !== undefined ? Math.max(1, Math.round(durationMs / 60000)) : undefined;

    const metaRows = [
      `<div><span class="meta-label">Ticket-ID:</span> <span class="meta-value">${ticket.id}</span></div>`,
      `<div><span class="meta-label">Guild:</span> <span class="meta-value">${TicketService.escapeHtml(
        channel.guild.name
      )} (${channel.guild.id})</span></div>`,
      `<div><span class="meta-label">Channel:</span> <span class="meta-value">#${TicketService.escapeHtml(
        channel.name
      )} (${channel.id})</span></div>`,
      `<div><span class="meta-label">Erstellt von:</span> <span class="meta-value">${ticket.creatorId}</span></div>`,
      ticket.assignedSupportId
        ? `<div><span class="meta-label">Bearbeiter:</span> <span class="meta-value">${ticket.assignedSupportId}</span></div>`
        : '',
      createdAt
        ? `<div><span class="meta-label">Erstellt am:</span> <span class="meta-value">${createdAt.toLocaleString(
            'de-DE'
          )}</span></div>`
        : '',
      closedAt
        ? `<div><span class="meta-label">Geschlossen am:</span> <span class="meta-value">${closedAt.toLocaleString(
            'de-DE'
          )}</span></div>`
        : '',
      durationMinutes !== undefined
        ? `<div><span class="meta-label">Dauer:</span> <span class="meta-value">${durationMinutes} Minuten</span></div>`
        : ''
    ]
      .filter(Boolean)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <title>Ticket ${ticket.id} Transcript</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #020617;
        --bg-elevated: #020617;
        --card: #020617;
        --card-border: #1f2937;
        --accent: #38bdf8;
        --accent-soft: rgba(56, 189, 248, 0.15);
        --text: #e5e7eb;
        --muted: #9ca3af;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 1.5rem;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: radial-gradient(circle at top, #0f172a 0, #020617 50%, #020617 100%);
        color: var(--text);
      }

      .layout {
        max-width: 960px;
        margin: 0 auto;
      }

      header.page-header {
        margin-bottom: 1.5rem;
      }

      .ticket-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }

      .ticket-subtitle {
        color: var(--muted);
        font-size: 0.9rem;
      }

      .meta-card {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.95));
        border-radius: 0.75rem;
        border: 1px solid var(--card-border);
        padding: 1rem 1.25rem;
        margin-bottom: 1rem;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.35rem 1.5rem;
        font-size: 0.9rem;
      }

      .meta-label {
        color: var(--muted);
        font-weight: 500;
        margin-right: 0.25rem;
      }

      .meta-value {
        color: var(--text);
      }

      .messages-section-title {
        margin: 1rem 0 0.5rem;
        font-size: 1.1rem;
        font-weight: 600;
      }

      .messages {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .message {
        background: rgba(15, 23, 42, 0.9);
        border-radius: 0.75rem;
        border: 1px solid var(--card-border);
        padding: 0.75rem 1rem;
      }

      .message-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.35rem;
      }

      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.4);
      }

      .author-block {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .author-tag {
        font-weight: 600;
      }

      .author-id {
        font-size: 0.8rem;
        color: var(--muted);
      }

      .timestamp {
        margin-left: auto;
        font-size: 0.8rem;
        color: var(--muted);
      }

      .message-content {
        font-size: 0.95rem;
        line-height: 1.4;
        white-space: normal;
        padding: 0.3rem 0 0.1rem;
      }

      .attachments {
        margin-top: 0.35rem;
        padding-top: 0.25rem;
        border-top: 1px dashed rgba(148, 163, 184, 0.5);
      }

      .attachment-link {
        color: var(--accent);
        text-decoration: none;
        font-size: 0.9rem;
      }

      .attachment-link:hover {
        text-decoration: underline;
      }

      .hint {
        margin-top: 1.5rem;
        font-size: 0.8rem;
        color: var(--muted);
      }

      @media (max-width: 640px) {
        body {
          padding: 1rem;
        }

        .message-header {
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .timestamp {
          margin-left: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="layout">
      <header class="page-header">
        <div class="ticket-title">Ticket #${ticket.id} – Transcript</div>
        <div class="ticket-subtitle">
          Export der Unterhaltung aus Discord – nur intern verwenden.
        </div>
      </header>

      <section class="meta-card">
        <div class="meta-grid">
${metaRows}
        </div>
      </section>

      <section>
        <div class="messages-section-title">Nachrichtenverlauf</div>
        <div class="messages">
${messageItems}
        </div>
      </section>

      <p class="hint">
        Hinweis: Inhalte stammen direkt aus Discord. Gelöschte Nachrichten zum Zeitpunkt des Exports
        sind hier nicht enthalten.
      </p>
    </main>
  </body>
</html>`;
  }

  private static escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
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
