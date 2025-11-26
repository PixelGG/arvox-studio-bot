import express from 'express';
import type { Client, TextChannel } from 'discord.js';
import { ChannelType, EmbedBuilder } from 'discord.js';
import type { AppConfig } from '../types/config';
import { EmbedSessionService } from '../services/EmbedSessionService';
import { EmbedDefinitionService } from '../services/EmbedDefinitionService';

export function startWebServer(client: Client, _config: AppConfig): void {
  const app = express();
  app.use(express.json());

  const port = Number(process.env.PORT ?? 3000);
  const baseUrl =
    process.env.EMBED_BASE_URL ??
    (process.env.NODE_ENV === 'production'
      ? `http://localhost:${port}`
      : `http://localhost:${port}`);

  // Simple logging so you see that the web server is running
  // eslint-disable-next-line no-console
  console.log(
    `Embed editor web server listening on port ${port}. Base URL: ${baseUrl}`
  );

  // HTML page for the embed editor
  app.get('/embed/:code', (req, res) => {
    const { code } = req.params;
    const session = EmbedSessionService.getSession(code);

    if (!session) {
      res.status(404).send('<h1>Session expired or invalid.</h1>');
      return;
    }

    res.type('html').send(getEmbedEditorHtml(code));
  });

  // Init endpoint: guild + channels + roles
  app.get('/api/embed/:code/init', async (req, res) => {
    const { code } = req.params;
    const session = EmbedSessionService.getSession(code);
    if (!session) {
      res.status(404).json({ error: 'invalid_session' });
      return;
    }

    try {
      const guild = await client.guilds.fetch(session.guildId);
      const channels = await guild.channels.fetch();

      const textChannels = Array.from(channels.values())
        .filter((ch): ch is Exclude<typeof ch, null> => ch !== null)
        .filter(
          (ch) =>
            ch.type === ChannelType.GuildText ||
            ch.type === ChannelType.GuildAnnouncement
        )
        .map((ch) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type
        }));

      const rolesCollection = await guild.roles.fetch();
      const roles = Array.from(rolesCollection.values())
        .filter((role) => role.id !== guild.id) // exclude everyone
        .sort((a, b) => b.position - a.position)
        .map((role) => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position
        }));

      res.json({
        guild: {
          id: guild.id,
          name: guild.name,
          iconUrl: guild.iconURL({ size: 128 }) ?? null
        },
        channels: textChannels,
        roles
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in /api/embed/init:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  // Send endpoint: post embed into selected channel
  app.post('/api/embed/:code/send', async (req, res) => {
    const { code } = req.params;
    const session = EmbedSessionService.getSession(code);
    if (!session) {
      res.status(404).json({ error: 'invalid_session' });
      return;
    }

    const {
      channelId,
      title,
      description,
      color,
      fields,
      imageUrl,
      thumbnailUrl,
      pingRoleIds
    } = req.body as {
      channelId: string;
      title: string;
      description: string;
      color?: number;
      fields?: { name: string; value: string }[];
      imageUrl?: string;
      thumbnailUrl?: string;
      pingRoleIds?: string[];
    };

    if (!channelId || !title || !description) {
      res.status(400).json({ error: 'missing_required_fields' });
      return;
    }

    try {
      const guild = await client.guilds.fetch(session.guildId);
      const channel = (await guild.channels.fetch(channelId)) as TextChannel | null;

      if (!channel || !channel.isTextBased()) {
        res.status(400).json({ error: 'invalid_channel' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: `Von ${session.createdBy}` })
        .setTimestamp(new Date());

      if (color) {
        embed.setColor(color);
      } else {
        embed.setColor(0xf97316);
      }

      if (guild.iconURL()) {
        embed.setAuthor({
          name: guild.name,
          iconURL: guild.iconURL({ size: 128 }) ?? undefined
        });
      }

      if (Array.isArray(fields)) {
        const cleaned = fields.filter(
          (f) =>
            typeof f.name === 'string' &&
            typeof f.value === 'string' &&
            f.name &&
            f.value
        );
        if (cleaned.length > 0) {
          embed.addFields(
            cleaned.map((f) => ({
              name: f.name,
              value: f.value,
              inline: false
            }))
          );
        }
      }

      if (imageUrl) {
        embed.setImage(imageUrl);
      }
      if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
      }

      let content: string | undefined;
      if (Array.isArray(pingRoleIds) && pingRoleIds.length > 0) {
        const mentions = pingRoleIds
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
          .map((id) => `<@&${id}>`)
          .join(' ');
        content = mentions || undefined;
      }

      await channel.send({ content, embeds: [embed] });
      EmbedSessionService.consumeSession(code);

      res.json({ ok: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in /api/embed/send:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  // --- Persistent embed definitions: backend endpoints for dashboard/API ---
  app.put('/api/embeds/:guildId/:key', async (req, res) => {
    const { guildId, key } = req.params;
    const { channelId, embed, components } = req.body as {
      channelId?: string;
      embed?: Record<string, unknown>;
      components?: Record<string, unknown>[];
    };

    if (!guildId || !key || !channelId || !embed) {
      res.status(400).json({ error: 'missing_required_fields' });
      return;
    }

    try {
      const def = await EmbedDefinitionService.upsertDefinition({
        guildId,
        key,
        channelId,
        embedPayload: embed,
        components
      });
      await EmbedDefinitionService.syncDefinition(client, guildId, key);
      res.json({ ok: true, definition: def });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in PUT /api/embeds:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  // --- Module manager endpoints ---
  app.get('/api/modules/:guildId', async (req, res) => {
    const { guildId } = req.params;
    try {
      const defs = await EmbedDefinitionService.getDefinition(guildId, 'dummy').catch(() => null); // no-op to ensure connection
      const [moduleDefs, guildModules] = await Promise.all([
        import('../services/ModuleService').then((m) => m.ModuleService.listDefinitions()),
        import('../services/ModuleService').then((m) => m.ModuleService.getGuildModules(guildId))
      ]);
      res.json({ definitions: moduleDefs, guildModules });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in GET /api/modules/:guildId', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.put('/api/modules/:guildId/:moduleKey', async (req, res) => {
    const { guildId, moduleKey } = req.params;
    const { enabled, settings } = req.body as {
      enabled: boolean;
      settings?: Record<string, unknown>;
    };

    if (enabled === undefined) {
      res.status(400).json({ error: 'enabled_required' });
      return;
    }

    try {
      const service = (await import('../services/ModuleService')).ModuleService;
      const doc = await service.setGuildModuleState(guildId, moduleKey, enabled, settings);
      res.json({ ok: true, module: doc });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in PUT /api/modules/:moduleKey', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  // Permission profiles
  app.get('/api/permissions/:guildId/profiles', async (req, res) => {
    const { guildId } = req.params;
    try {
      const service = (await import('../services/ModuleService')).ModuleService;
      const profiles = await service.listPermissionProfiles(guildId);
      res.json({ profiles });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in GET /api/permissions/:guildId/profiles', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.put('/api/permissions/:guildId/profiles/:profileKey', async (req, res) => {
    const { guildId, profileKey } = req.params;
    const { label, roleIds, actions } = req.body as {
      label: string;
      roleIds: string[];
      actions: Record<string, string[]>;
    };

    if (!label || !Array.isArray(roleIds)) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }

    try {
      const service = (await import('../services/ModuleService')).ModuleService;
      const doc = await service.upsertPermissionProfile({
        guildId,
        profileKey,
        label,
        roleIds,
        actions: actions ?? {}
      });
      res.json({ ok: true, profile: doc });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in PUT /api/permissions/:guildId/profiles/:profileKey', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.delete('/api/permissions/:guildId/profiles/:profileKey', async (req, res) => {
    const { guildId, profileKey } = req.params;
    try {
      const service = (await import('../services/ModuleService')).ModuleService;
      await service.deletePermissionProfile(guildId, profileKey);
      res.json({ ok: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in DELETE /api/permissions/:guildId/profiles/:profileKey', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  // Config profiles
  app.get('/api/config-profiles/:guildId', async (req, res) => {
    const { guildId } = req.params;
    try {
      const service = (await import('../services/ModuleService')).ModuleService;
      const profiles = await service.listConfigProfiles(guildId);
      res.json({ profiles });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in GET /api/config-profiles/:guildId', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.post('/api/config-profiles/:guildId', async (req, res) => {
    const { guildId } = req.params;
    const { name, description, snapshot, isActive } = req.body as {
      name: string;
      description?: string;
      snapshot: Record<string, unknown>;
      isActive?: boolean;
    };

    if (!name || !snapshot) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }

    try {
      const service = (await import('../services/ModuleService')).ModuleService;
      const doc = await service.createConfigProfile({ guildId, name, description, snapshot, isActive });
      res.json({ ok: true, profile: doc });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in POST /api/config-profiles/:guildId', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.post('/api/config-profiles/:guildId/:name/activate', async (req, res) => {
    const { guildId, name } = req.params;
    try {
      const service = (await import('../services/ModuleService')).ModuleService;
      await service.activateConfigProfile(guildId, name);
      res.json({ ok: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in POST /api/config-profiles/:guildId/:name/activate', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.delete('/api/config-profiles/:guildId/:name', async (req, res) => {
    const { guildId, name } = req.params;
    try {
      const service = (await import('../services/ModuleService')).ModuleService;
      await service.deleteConfigProfile(guildId, name);
      res.json({ ok: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in DELETE /api/config-profiles/:guildId/:name', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  // Analytics summary
  app.get('/api/analytics/:guildId/summary', async (req, res) => {
    const { guildId } = req.params;
    try {
      const { WarningModel } = await import('../db/models/Warning');
      const { TicketModel } = await import('../db/models/Ticket');
      const { JoinLeaveModel } = await import('../db/models/JoinLeave');

      const [warnings, ticketsOpen, ticketsClosed, joins7, leaves7] = await Promise.all([
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

      res.json({
        warnings,
        tickets: { open: ticketsOpen, closed: ticketsClosed },
        joins7,
        leaves7
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in GET /api/analytics/:guildId/summary', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.get('/api/embeds/:guildId/:key', async (req, res) => {
    const { guildId, key } = req.params;
    if (!guildId || !key) {
      res.status(400).json({ error: 'missing_required_fields' });
      return;
    }

    try {
      const def = await EmbedDefinitionService.getDefinition(guildId, key);
      if (!def) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({ definition: def });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in GET /api/embeds:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.post('/api/embeds/:guildId/:key/sync', async (req, res) => {
    const { guildId, key } = req.params;
    if (!guildId || !key) {
      res.status(400).json({ error: 'missing_required_fields' });
      return;
    }

    try {
      await EmbedDefinitionService.syncDefinition(client, guildId, key);
      res.json({ ok: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error in POST /api/embeds/:key/sync:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  });

  try {
    const server = app.listen(port, () => {
      // already logged above
    });
    server.on('error', (error: any) => {
      if (error && error.code === 'EADDRINUSE') {
        // eslint-disable-next-line no-console
        console.warn(`Embed editor web server not started: port ${port} already in use.`);
      } else {
        // eslint-disable-next-line no-console
        console.error('Web server error:', error);
      }
    });
  } catch (error: any) {
    // If port is in use, skip starting the web server to avoid crashing the bot
    if (error && error.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.warn(`Embed editor web server not started: port ${port} already in use.`);
    } else {
      throw error;
    }
  }
}

function getEmbedEditorHtml(code: string): string {
  // HTML and JS are kept ASCII-only to avoid encoding issues.
  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <title>Arvox Studio Bot - Embed Editor</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #020617;
        --card: #020617;
        --card-border: #1f2937;
        --accent: #38bdf8;
        --accent-strong: #f97316;
        --text: #e5e7eb;
        --muted: #9ca3af;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 1.5rem;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #0f172a 0, #020617 50%, #020617 100%);
        color: var(--text);
        min-height: 100vh;
      }

      .layout {
        max-width: 1280px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
        gap: 1.5rem;
      }

      header {
        grid-column: 1 / -1;
        margin-bottom: 0.75rem;
      }

      .title { font-size: 1.6rem; font-weight: 600; }
      .subtitle { font-size: 0.9rem; color: var(--muted); }

      .card {
        background: rgba(15, 23, 42, 0.97);
        border-radius: 0.75rem;
        border: 1px solid var(--card-border);
        padding: 1rem 1.25rem;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.9);
      }

      .section-title { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem; }

      label {
        display: block;
        font-size: 0.8rem;
        color: var(--muted);
        margin-bottom: 0.25rem;
      }

      input[type="text"], textarea, select {
        width: 100%;
        background: #020617;
        border-radius: 0.5rem;
        border: 1px solid #1f2937;
        padding: 0.4rem 0.6rem;
        color: var(--text);
        font-size: 0.9rem;
        outline: none;
      }

      input[type="text"]:focus, textarea:focus, select:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.3);
      }

      textarea { min-height: 120px; resize: vertical; }

      .row { display: flex; gap: 0.5rem; }
      .row > div { flex: 1; }

      .fields { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }

      .field-item {
        border-radius: 0.5rem;
        border: 1px dashed #374151;
        padding: 0.5rem 0.6rem;
        background: rgba(15, 23, 42, 0.9);
      }

      .field-row { display: flex; gap: 0.5rem; align-items: flex-end; }
      .field-row > div { flex: 1; }
      .remove-field { padding: 0.35rem 0.7rem; font-size: 0.8rem; }

      .role-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.25rem 0.55rem;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.6);
        font-size: 0.8rem;
        color: var(--text);
      }

      .role-chip button {
        padding: 0;
        border: none;
        background: none;
        color: var(--muted);
        cursor: pointer;
        font-size: 0.8rem;
      }

      .buttons { margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
      button {
        border-radius: 999px;
        border: none;
        padding: 0.45rem 0.9rem;
        font-size: 0.9rem;
        cursor: pointer;
        font-weight: 500;
      }
      .btn-primary { background: linear-gradient(135deg, var(--accent-strong), #fb923c); color: #0b1120; }
      .btn-secondary { background: rgba(15, 23, 42, 0.9); color: var(--text); border: 1px solid #374151; }
      .status { margin-top: 0.5rem; font-size: 0.8rem; color: var(--muted); }

      .embed-message { display: flex; gap: 0.75rem; font-size: 0.9rem; }
      .embed-avatar { width: 40px; height: 40px; border-radius: 999px; background: #111827; }
      .embed-body { flex: 1; }

      .embed-ping-line {
        font-size: 0.8rem;
        color: var(--accent);
        margin-bottom: 0.25rem;
      }

      .embed-container {
        border-radius: 0.5rem;
        border-left: 4px solid var(--accent-strong);
        background: rgba(15, 23, 42, 0.95);
        padding: 0.8rem 0.95rem;
      }

      .embed-author { font-size: 0.8rem; color: var(--muted); margin-bottom: 0.2rem; }
      .embed-title { font-weight: 600; margin-bottom: 0.2rem; }
      .embed-description { font-size: 0.9rem; margin-bottom: 0.4rem; white-space: pre-wrap; }
      .embed-field { margin-bottom: 0.35rem; }
      .embed-field-name { font-size: 0.8rem; font-weight: 600; }
      .embed-field-value { font-size: 0.9rem; white-space: pre-wrap; }
      .embed-footer { font-size: 0.75rem; color: var(--muted); margin-top: 0.5rem; }

      .embed-image-wrapper {
        margin-top: 0.4rem;
      }

      .embed-image {
        max-width: 100%;
        border-radius: 0.5rem;
        border: 1px solid #1f2937;
        display: block;
      }

      .embed-thumbnail-wrapper {
        margin-top: 0.4rem;
        text-align: right;
      }

      .embed-thumbnail {
        width: 64px;
        height: 64px;
        object-fit: cover;
        border-radius: 0.5rem;
        border: 1px solid #1f2937;
      }

      @media (max-width: 900px) {
        .layout { grid-template-columns: minmax(0, 1fr); }
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <header>
        <div class="title">Arvox Studio Bot - Embed Editor</div>
        <div class="subtitle">
          Session-Code: <code>${code}</code> - Erstelle ein Embed, waehle einen Text-Channel und sende es direkt ueber den Bot.
        </div>
      </header>

      <section class="card">
        <div class="section-title">Inhalt & Ziel-Channel</div>
        <div style="margin-bottom: 0.5rem;">
          <label for="channel">Channel</label>
          <select id="channel"></select>
        </div>
        <div class="row" style="margin-bottom: 0.5rem;">
          <div>
            <label for="pingRoleSelect">Ping-Rollen (optional)</label>
            <select id="pingRoleSelect">
              <option value="">Rolle auswaehlen...</option>
            </select>
            <div id="pingRoleChips" class="fields" style="margin-top: 0.35rem;"></div>
          </div>
          <div>
            <label for="color">Farbe (Hex, optional)</label>
            <input id="color" type="text" placeholder="#F97316" />
          </div>
        </div>
        <div style="margin-bottom: 0.5rem;">
          <label for="title">Titel</label>
          <input id="title" type="text" placeholder="Titel des Embeds" />
        </div>
        <div style="margin-bottom: 0.5rem;">
          <label for="description">Beschreibung</label>
          <textarea id="description" placeholder="Haupttext des Embeds (Discord rendert Markdown selbst)"></textarea>
        </div>
        <div class="row" style="margin-bottom: 0.5rem;">
          <div>
            <label for="imageUrl">Bild-URL (optional)</label>
            <input id="imageUrl" type="text" />
          </div>
          <div>
            <label for="thumbnailUrl">Thumbnail-URL (optional)</label>
            <input id="thumbnailUrl" type="text" />
          </div>
        </div>

        <div class="section-title" style="margin-top: 0.75rem;">Felder (optional)</div>
        <div class="fields" id="fieldsContainer"></div>
        <div class="buttons">
          <button class="btn-secondary" type="button" id="addFieldBtn">Feld hinzufuegen</button>
        </div>

        <div class="buttons" style="margin-top: 0.75rem;">
          <button class="btn-secondary" type="button" id="previewBtn">Vorschau aktualisieren</button>
          <button class="btn-primary" type="button" id="sendBtn">Embed senden</button>
        </div>
        <div class="status" id="status"></div>
      </section>

      <section class="card embed-preview-wrapper">
        <div class="section-title">Vorschau</div>
        <div class="embed-message">
          <div class="embed-avatar"></div>
          <div class="embed-body">
            <div id="previewPingLine" class="embed-ping-line" style="display: none;"></div>
            <div class="embed-container">
              <div class="embed-author" id="previewAuthor"></div>
              <div class="embed-title" id="previewTitle">Titel</div>
              <div class="embed-description" id="previewDescription">Beschreibung</div>
              <div id="previewImageWrapper" class="embed-image-wrapper" style="display: none;">
                <img id="previewImage" class="embed-image" alt="Embed Bild Vorschau" />
              </div>
              <div id="previewThumbnailWrapper" class="embed-thumbnail-wrapper" style="display: none;">
                <img id="previewThumbnail" class="embed-thumbnail" alt="Embed Thumbnail Vorschau" />
              </div>
              <div id="previewFields"></div>
              <div class="embed-footer" id="previewFooter">Von ...</div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <script>
      const code = ${JSON.stringify(code)};

      function addField(name = '', value = '') {
        const container = document.getElementById('fieldsContainer');
        const item = document.createElement('div');
        item.className = 'field-item';

        const row = document.createElement('div');
        row.className = 'field-row';

        const col1 = document.createElement('div');
        const label1 = document.createElement('label');
        label1.textContent = 'Feld Titel';
        const input1 = document.createElement('input');
        input1.type = 'text';
        input1.className = 'field-name';
        input1.value = name;
        col1.appendChild(label1);
        col1.appendChild(input1);

        const col2 = document.createElement('div');
        const label2 = document.createElement('label');
        label2.textContent = 'Feld Inhalt';
        const input2 = document.createElement('input');
        input2.type = 'text';
        input2.className = 'field-value';
        input2.value = value;
        col2.appendChild(label2);
        col2.appendChild(input2);

        const col3 = document.createElement('div');
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-secondary remove-field';
        removeBtn.textContent = 'x';
        removeBtn.addEventListener('click', () => {
          container.removeChild(item);
          updatePreview();
        });
        col3.appendChild(removeBtn);

        row.appendChild(col1);
        row.appendChild(col2);
        row.appendChild(col3);
        item.appendChild(row);
        container.appendChild(item);

        input1.addEventListener('input', updatePreview);
        input2.addEventListener('input', updatePreview);
      }

      async function init() {
        const statusEl = document.getElementById('status');
        statusEl.textContent = 'Lade Channels und Rollen...';
        try {
          const res = await fetch('/api/embed/' + code + '/init');
          if (!res.ok) {
            statusEl.textContent = 'Fehler beim Laden der Session/Channels.';
            return;
          }
          const data = await res.json();

          const channelSelect = document.getElementById('channel');
          channelSelect.innerHTML = '';
          data.channels
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach((ch) => {
              const opt = document.createElement('option');
              opt.value = ch.id;
              opt.textContent = '#' + ch.name;
              channelSelect.appendChild(opt);
            });

          const roleSelect = document.getElementById('pingRoleSelect');
          const chipsContainer = document.getElementById('pingRoleChips');
          roleSelect.innerHTML = '';
          const noneOpt = document.createElement('option');
          noneOpt.value = '';
          noneOpt.textContent = 'Rolle auswaehlen...';
          roleSelect.appendChild(noneOpt);
          data.roles.forEach((role) => {
            const opt = document.createElement('option');
            opt.value = role.id;
            opt.textContent = '@' + role.name;
            roleSelect.appendChild(opt);
          });

          roleSelect.addEventListener('change', () => {
            const selectedId = roleSelect.value;
            if (!selectedId) return;

            const selectedOption = roleSelect.options[roleSelect.selectedIndex];
            const label = selectedOption.textContent;

            const chip = document.createElement('div');
            chip.className = 'role-chip';
            chip.setAttribute('data-role-id', selectedId);
            chip.setAttribute('data-role-label', label);

            const labelSpan = document.createElement('span');
            labelSpan.textContent = label;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = 'x';
            removeBtn.addEventListener('click', () => {
              chipsContainer.removeChild(chip);
              const opt = document.createElement('option');
              opt.value = selectedId;
              opt.textContent = label;
              roleSelect.appendChild(opt);
              updatePreview();
            });

            chip.appendChild(labelSpan);
            chip.appendChild(removeBtn);
            chipsContainer.appendChild(chip);

            roleSelect.removeChild(selectedOption);
            roleSelect.value = '';
            updatePreview();
          });

          document.getElementById('previewAuthor').textContent = data.guild.name;
          document.getElementById('previewFooter').textContent = 'Von ...';

          statusEl.textContent =
            'Session bereit. Erstelle dein Embed und klicke auf "Embed senden".';
        } catch (err) {
          console.error(err);
          document.getElementById('status').textContent =
            'Fehler beim Laden der Session/Channels.';
        }
      }

      function updatePreview() {
        const titleInput = document.getElementById('title');
        const descInput = document.getElementById('description');
        const colorInput = document.getElementById('color');
        const title = (titleInput.value || '').trim() || 'Titel';
        const description = (descInput.value || '').trim() || 'Beschreibung';
        const colorValue = (colorInput.value || '').trim();

        const previewTitle = document.getElementById('previewTitle');
        const previewDescription = document.getElementById('previewDescription');
        const embedContainer = document.querySelector('.embed-container');
        const pingLine = document.getElementById('previewPingLine');
        const chipsContainer = document.getElementById('pingRoleChips');

        previewTitle.textContent = title;
        previewDescription.textContent = description;

        // color bar
        let borderColor = 'var(--accent-strong)';
        if (colorValue) {
          const hex = colorValue.startsWith('#') ? colorValue.slice(1) : colorValue;
          if (/^[0-9a-fA-F]{6}$/.test(hex)) {
            borderColor = '#' + hex;
          }
        }
        if (embedContainer) {
          embedContainer.style.borderLeftColor = borderColor;
        }

        // ping line
        const chips = chipsContainer.querySelectorAll('.role-chip');
        if (chips.length > 0) {
          const labels = Array.from(chips)
            .map((chip) => chip.getAttribute('data-role-label'))
            .filter((label) => !!label);
          pingLine.textContent = labels.join(' ');
          pingLine.style.display = '';
        } else {
          pingLine.textContent = '';
          pingLine.style.display = 'none';
        }

        // images
        const imageUrl = document.getElementById('imageUrl').value.trim();
        const thumbnailUrl = document.getElementById('thumbnailUrl').value.trim();
        const imageWrapper = document.getElementById('previewImageWrapper');
        const imageEl = document.getElementById('previewImage');
        const thumbWrapper = document.getElementById('previewThumbnailWrapper');
        const thumbEl = document.getElementById('previewThumbnail');

        if (imageUrl) {
          imageWrapper.style.display = 'block';
          imageEl.src = imageUrl;
        } else {
          imageWrapper.style.display = 'none';
          imageEl.removeAttribute('src');
        }

        if (thumbnailUrl) {
          thumbWrapper.style.display = 'block';
          thumbEl.src = thumbnailUrl;
        } else {
          thumbWrapper.style.display = 'none';
          thumbEl.removeAttribute('src');
        }

        // fields
        const previewFields = document.getElementById('previewFields');
        previewFields.innerHTML = '';
        const container = document.getElementById('fieldsContainer');
        const items = container.querySelectorAll('.field-item');
        items.forEach((item) => {
          const nameInput = item.querySelector('.field-name');
          const valueInput = item.querySelector('.field-value');
          const name = nameInput.value.trim();
          const value = valueInput.value.trim();
          if (!name || !value) return;

          const fieldEl = document.createElement('div');
          fieldEl.className = 'embed-field';
          const nameEl = document.createElement('div');
          nameEl.className = 'embed-field-name';
          nameEl.textContent = name;
          const valueEl = document.createElement('div');
          valueEl.className = 'embed-field-value';
          valueEl.textContent = value;
          fieldEl.appendChild(nameEl);
          fieldEl.appendChild(valueEl);
          previewFields.appendChild(fieldEl);
        });
      }

      function getSelectedRoleIds() {
        const chipsContainer = document.getElementById('pingRoleChips');
        const chips = chipsContainer.querySelectorAll('.role-chip');
        const ids = [];
        chips.forEach((chip) => {
          const id = chip.getAttribute('data-role-id');
          if (id) ids.push(id);
        });
        return ids;
      }

      async function sendEmbed() {
        const statusEl = document.getElementById('status');
        const channelId = document.getElementById('channel').value;
        const title = document.getElementById('title').value.trim();
        const description = document.getElementById('description').value.trim();
        const imageUrl =
          document.getElementById('imageUrl').value.trim() || undefined;
        const thumbnailUrl =
          document.getElementById('thumbnailUrl').value.trim() || undefined;
        const colorInput = document.getElementById('color').value.trim();
        const pingRoleIds = getSelectedRoleIds();

        if (!channelId || !title || !description) {
          statusEl.textContent =
            'Bitte Titel, Beschreibung und Channel ausfuellen.';
          return;
        }

        let color;
        if (colorInput) {
          const hex = colorInput.startsWith('#') ? colorInput.slice(1) : colorInput;
          if (/^[0-9a-fA-F]{6}$/.test(hex)) {
            color = parseInt(hex, 16);
          }
        }

        const fields = [];
        const container = document.getElementById('fieldsContainer');
        const items = container.querySelectorAll('.field-item');
        items.forEach((item) => {
          const nameInput = item.querySelector('.field-name');
          const valueInput = item.querySelector('.field-value');
          const name = nameInput.value.trim();
          const value = valueInput.value.trim();
          if (name && value) {
            fields.push({ name, value });
          }
        });

        statusEl.textContent = 'Sende Embed...';

        try {
          const res = await fetch('/api/embed/' + code + '/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelId,
              title,
              description,
              color,
              imageUrl,
              thumbnailUrl,
              pingRoleIds,
              fields
            })
          });

          if (!res.ok) {
            statusEl.textContent = 'Fehler beim Senden des Embeds.';
            return;
          }

          statusEl.textContent = 'Embed wurde erfolgreich gesendet.';
        } catch (err) {
          console.error(err);
          statusEl.textContent = 'Fehler beim Senden des Embeds.';
        }
      }

      document
        .getElementById('previewBtn')
        .addEventListener('click', updatePreview);
      document.getElementById('sendBtn').addEventListener('click', sendEmbed);
      document
        .getElementById('addFieldBtn')
        .addEventListener('click', () => addField());
      document
        .getElementById('title')
        .addEventListener('input', updatePreview);
      document
        .getElementById('description')
        .addEventListener('input', updatePreview);
      document
        .getElementById('color')
        .addEventListener('input', updatePreview);
      document
        .getElementById('imageUrl')
        .addEventListener('input', updatePreview);
      document
        .getElementById('thumbnailUrl')
        .addEventListener('input', updatePreview);

      addField();
      init();
      updatePreview();
    </script>
  </body>
</html>`;
}
