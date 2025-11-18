# Arvox Studio Bot

Ein modularer, produktionsnaher Discord-Bot für den **Arvox Studio** Server.  
Fokus: klare Strukturen, saubere Embeds und möglichst wenig Spam im Channel durch ein **Persistent-Embed-System**.

> Onboarding · Self-Roles · Tickets & HTML-Transcripts · Voice-Support-Queue · 24/7 Radio · GitHub-Projektindex · Staff-Tools

---

## Tech & Status

- **Sprache:** TypeScript (Node.js 20)
- **Library:** discord.js v14
- **Voice:** @discordjs/voice (+ Opus, FFmpeg, DAVE)
- **DB:** MongoDB via mongoose
- **HTTP:** axios (GitHub API)

---

## Feature-Overview

| Bereich               | Kernfunktionen                                                                                      |
|----------------------|-----------------------------------------------------------------------------------------------------|
| Start Here           | Welcome, Rules, Info, Announcements, Self-Roles                                                    |
| User Lounge & Radio  | 24/7 Radio mit Auto-Join/Leave, Radio-Status-Panel                                                 |
| Support              | Ticket-Panel, Ticket-Channels, HTML-Transcripts, Support-Log, Voice-Support-Queue                  |
| Community            | Giveaways mit Slash-Commands & Buttons                                                              |
| Studio Projects      | GitHub-Projektindex als persistentes Embed                                                          |
| Team (Staff)         | Staff Announcements, Öffentliche Announcements, Standup, Mod-Queue, Audit-Log                      |
| Archive & Security   | Join/Leave-Log, AutoMod-Log, Ticket-Archive                                                         |
| Cross-Cutting System | Persistent Embeds (Single-Embed-System für Panels & Status-Overviews)                              |

---

## Start Here

### Welcome

- Automatisches **Welcome-Embed** bei `guildMemberAdd`.
- Optional: Willkommens-DM (konfigurierbar).
- Auto-Roles nach Regel-Akzept über das Rules-System.

### Rules (Regelwerk)

- Regeln als **konfigurierbare Sections** in der Config (`rules.sections`).
- Panel wird über `/rules post` gesetzt:
  - Mehrere Embeds (Section-basiert).
  - Button „Regeln akzeptieren“ (`rules_accept`).
- Beim Klick:
  - Zuweisung von `rules.acceptRoles` (z. B. `Verified`, `Member`).
  - Logging via `LoggingService` in den Audit-Log.
- Panel nutzt `PersistentMessageService` → eine Message, nur `edit`, kein Spam.

### Info

- Statisches **Info-Embed** mit:
  - Beschreibung des Servers.
  - Wichtige Kategorien & Channel-Links.
  - Externe Links (GitHub, Website, etc.).
- Gesetzt über `/info post`.
- Persistentes Embed (`info_main`) im konfigurierten Info-Channel.

### Announcements

- Öffentliche Ankündigungen via `/announce create`:
  - Titel, Text, optionales Bild/Thumbnail.
  - Optionale Ping-Rolle (z. B. `Nova Updates`, `Events`, `Playtest`).
  - Postet in `channels.announcements`.
- Staff-Announcements via `/staffannounce create`:
  - Nur intern für `staffAnnouncements`-Channel.
  - Ebenfalls mit optionalem Ping.
- Historie bleibt vollständig sichtbar (kein Persistent-Panel, jede Ankündigung ist eine eigene Message).

### Roles (Self-Roles)

- Rollen-Panel als Select-Menü:
  - Typische Rollen: `Nova Updates`, `Playtest`, `Events`, `News`.
- `/roles post`:
  - Setzt oder aktualisiert das persistente `roles_panel` im konfigurierten Roles-Channel.
  - User können ihre Benachrichtigungsrollen selbst toggeln.

---

## User Lounge & Radio

### Radio (24/7 Musik)

- Konfigurierbarer Radiostream (z. B. externe Webradio-URLs).
- Voice-Channel aus Config (`music.voiceChannelId`).
- Features:
  - **Auto-Join**: Bot joint den Musik-Channel nur, wenn mindestens ein User drin ist.
  - **Auto-Leave**: Wenn der letzte nicht-Bot den Channel verlässt, disconnectet der Bot.
  - **Auto-Resume**: Nach Neustart/crash wird das Radio wieder gestartet, wenn Hörer im Channel sind.
  - **Persistente Lautstärke**: Volume wird pro Guild gespeichert und wiederhergestellt.

**Commands (`/radio`):**

- `/radio panel`  
  - Setzt/aktualisiert das Radio-Status-Panel (`radio_status`) im Info-Channel.

- `/radio start [voice_channel] [preset]`  
  - Aktiviert das Radio (setzt `isPlaying = true`).
  - Joint Voice, wenn bereits Hörer im Channel sind.

- `/radio stop`  
  - Deaktiviert Radio (`isPlaying = false`) und verlässt den Channel.

- `/radio set-stream [preset/url]`  
  - Aktualisiert Stream-URL (oder nutzt Preset aus `music.presets`).
  - Speichert URL in der DB, sodass nach Neustart dieselbe Quelle genutzt wird.

- `/radio volume percent:<0-200>`  
  - Setzt Lautstärke in Prozent.
  - Volume wird in der DB persistiert (per Guild).

- `/radio status`  
  - Zeigt aktuellen Status als Embed (läuft/nicht, Channel, Stream, Uptime, Listener, Volume).

**Status-Panel:**  
`radio_status` im Info-Channel wird automatisch aktualisiert bei:

- `/radio`-Commands.
- Voice-Events (Join/Leave im Musik-Channel).
- Bot-Start (`ready` Event).

---

## Support & Tickets

### Ticket-System

- Ticket-Datenmodell in MongoDB (`Tickets`):
  - `id`, `guildId`, `channelId`, `creatorId`, `assignedSupportId?`.
  - `status: "open" | "in_progress" | "closed"`.
  - `topic?`, `tags?`, `createdAt`, `closedAt?`, `transcriptUrl?`.

**Panel & Eröffnung**

- `/ticket panel`:
  - Setzt das persistente `tickets_panel` mit einem „Ticket eröffnen“-Button.
- Button `ticket_open` oder `/ticket open [topic]`:
  - Erstellt Ticket-Channel in konfigurierter Kategorie.
  - Permissions: Ersteller + Support/Admin, Rest ohne Sicht.
  - Ticket-Dokument wird in der DB angelegt.
  - Start-Embed im Ticket-Channel + Logging im Support-Log.

**Ticket-Commands**

- `/ticket claim` – Ticket übernehmen (`assignedSupportId` setzen).
- `/ticket add @User/@Role` – Berechtigungen ergänzen.
- `/ticket remove @User/@Role` – Berechtigungen entfernen.
- `/ticket close [reason]` – Ticket schließen:
  - Lädt alle Nachrichten über die API.
  - Generiert ein **HTML-Transcript** mit modernem Dark-UI:
    - Karten pro Nachricht (Avatar, Tag, Zeit, Inhalt, Attachments).
    - Meta-Block (Ticket-ID, Guild, Channel, Ersteller, Bearbeiter, Dauer).
  - Postet HTML als Datei im Ticket-Archive-Channel (+ Embed mit Metadaten).
  - Speichert `transcriptUrl` im Ticket-Dokument.
  - Schließt/entfernt den Ticket-Channel.

### Voice-Support-Queue

- Warteschlange pro Guild (`SupportQueueService`), FIFO, in Memory.
- Konfiguration:
  - `supportQueue.queueVoiceChannelId`
  - `supportQueue.supportVoiceChannelIds[]`
  - `supportQueue.statusMessageChannelId?` (optional Panel).

**Verhalten (Voice-Events):**

- User joint `queueVoiceChannel`:
  - Wird zur Queue hinzugefügt.
  - Optional DM + Log in Support-Log.
- Supporter joint einen Support-Voice:
  - Nächster User aus der Queue wird in diesen Channel gezogen.
  - Logging im Support-Log.
- User verlässt Queue:
  - Wird aus Queue entfernt.

**Commands (`/supportqueue`):**

- `status` – aktuelle Queue anzeigen (Embed).
- `clear` – Queue leeren (Staff-only).

**Status-Panel (`support_queue_status`):**

- Optionales Dashboard im konfigurierten Channel, via Persistent-Embed-Service gepflegt.

---

## Community: Giveaways

- Mongo-Collection `Giveaways`:
  - `id`, `guildId`, `channelId`, `messageId`, `prize`, `winnerCount`, `hostId`.
  - `status: "running" | "ended"`, `endAt`, `participants: string[]`.

**Commands (`/giveaway`):**

- `panel` – erklärt Giveaways im `giveaways`-Channel (persistent `giveaway_panel`).  
- `create` – neues Giveaway mit Button „Teilnehmen“.
- `end` – laufendes Giveaway beenden, Gewinner auslosen und anzeigen.
- `reroll` – neuen Gewinner für ein beendetes Giveaway ziehen.

Teilnahme wird über Button-Toggle (join/leave) geregelt; Giveaways werden bei Bot-Start automatisch fortgesetzt/abgeschlossen.

---

## Studio Projects / GitHub

### GitHub-Projektindex

- Service `GithubService` pollt regelmäßig die GitHub-API:
  - User-Name und Filter aus Config (`github.username`, `ignoredRepos`, `trackAllPublicRepos`, `trackedRepos`).
  - Speichert Repos in Mongo (`Repositories`).
- Persistent-Panel `project_index_main` im Project-Index-Channel:
  - Liste der zuletzt aktiven Repos (Name, Link, letzte Aktivität).

**Commands (`/github`):**

- `sync` – manuelles Refresh des Projektindex (Staff-only).

### Polling

- Intervall über `github.pollingIntervalMinutes` (Standard: 60 Minuten).
- Zusätzlich initialer Sync beim Bot-Start.

---

## Team (Staff) & Logs

### Staff & Public Announcements

- `/staffannounce create`:
  - Interne Staff-Ankündigungen im `staffAnnouncements`-Channel.
  - Nur Owner/Admin/DevLead (und Manage Guild).
- `/announce create`:
  - Öffentliche Ankündigungen im `announcements`-Channel.
  - Titel, Text, optional Bild/Thumbnail, optional Ping-Rolle.

### Standup

- `/standup start` – Startet ein Standup im `standup`-Channel (Button → Modal).
- Nutzer füllen Modal aus (Gestern/Heute/Blocker); Einträge werden in Mongo gespeichert (`StandupEntries`).
- `/standup summary [date]` – Zusammenfassung für einen Tag (Embed mit Antworten).

### Mod-Queue & Reports

- `/report user @User <Grund> [message_link]`:
  - Erstellt ein Report-Embed im `modQueue`-Channel (gemeldeter User, Melder, Grund, Link).

### Logging

`LoggingService` schreibt in die konfigurierten Log-Channels:

- Join/Leave → `joinLeaveLog`.
- AutoMod-Events → `automodLog`.
- Audit-Events → `auditLog`.
- Support-/Ticket-Events → `supportLog`.
- Ticket-Archive → `ticketArchive` (mit HTML-Dateien als Attachments).

---

## Persistent-Embed-System

Zentrales System für alle statischen Panels/Status-Overviews.

**Keys (Beispiele):**

- `rules_main`
- `info_main`
- `roles_panel`
- `tickets_panel`
- `support_queue_status`
- `radio_status`
- `project_index_main`
- `giveaway_panel`

**Datenmodell (`PersistentMessages`):**

- `guildId`, `key`
- `channelId`, `messageId`
- `createdAt`, `updatedAt`
- optional `meta`

**Verhalten (`PersistentMessageService`):**

- `ensurePersistentMessage(guildId, key, channelId, renderFn)`:
  - Wenn DB-Eintrag vorhanden → versucht `message.edit(...)`, sonst `channel.send(...)` + Update.
  - Wenn kein Eintrag → sendet neue Message + Eintrag anlegen.
- `updatePersistentMessage(guildId, key, renderFn)` analog, ohne Channel-Wechsel.

Damit bleibt pro Panel **immer genau eine Message** im Channel; Änderungen laufen ausschließlich über `edit`.

---

## Projektstruktur

```text
arvox-studio-bot/
  src/
    commands/          # Slash-Commands (admin, tickets, radio, giveaways, supportqueue, github, ...)
    events/            # Discord-Events (ready, interactionCreate, guildMemberAdd, voiceStateUpdate, ...)
    services/          # Business-Logik (TicketService, RadioService, GithubService, PersistentMessageService, ...)
    config/            # Konfiguration (default.json, Loader)
    db/                # Mongo-Models (Tickets, Giveaways, PersistentMessages, RadioState, Repositories, StandupEntries)
    types/             # Eigene Typdefinitionen/Interfaces
    utils/             # Command-Loader, Hilfsfunktionen
    index.ts           # Einstiegspunkt
  .env.example         # ENV-Beispiele (DISCORD_TOKEN, DATABASE_URL, ...)
  package.json
  tsconfig.json
  README.md
```

---

## Setup (Entwicklung)

1. Dependencies installieren:

   ```bash
   npm install
   ```

2. `.env` erstellen (auf Basis von `.env.example`):

   ```env
   DISCORD_TOKEN=DEIN_DEV_BOT_TOKEN
   DISCORD_CLIENT_ID=DEINE_APP_ID
   DISCORD_GUILD_ID=DEINE_DEV_GUILD_ID

   DATABASE_URL=mongodb://localhost:27017/arvox-studio-bot

   GITHUB_USERNAME=PixelGG
   GITHUB_TOKEN=   # optional
   PORT=3000
   ```

3. Config anpassen (`src/config/default.json`):

   - Guild-ID.
   - Channel-IDs.
   - Role-IDs.
   - Feature-Flags (music, github, supportQueue, ...).

4. Dev-Start:

   ```bash
   npm run dev
   ```

   Der Bot deployed die Guild-Commands automatisch und loggt sich ein.

---

## Build & Deployment

1. Produktions-Build erzeugen:

   ```bash
   npm run build
   ```

2. Auf Server übertragen (z. B. via Git oder Datei-Kopie):

   ```text
   /opt/arvox-studio-bot/
     package.json
     dist/
       index.js
       ...
   ```

3. Auf dem Server:

   ```bash
   cd /opt/arvox-studio-bot
   npm install --omit=dev
   # .env mit Produktionswerten anlegen
   node dist/index.js
   ```

4. Optional mit Prozess-Manager (z. B. `pm2`) betreiben.

---

## Lizenz

Dieses Projekt verwendet die Lizenz aus der Datei `LICENSE` im Repository-Root.*** End Patch```}()
