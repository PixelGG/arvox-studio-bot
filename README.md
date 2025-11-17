# 🤖 Arvox Studio Bot

Ein modularer, voll konfigurierbarer Discord-Bot für den **Arvox Studio** Server.  
Fokus: klare Strukturen, saubere Embeds, möglichst wenig Spam im Channel durch ein **Persistent-Embed-System**.

> Onboarding · Self-Roles · Tickets & HTML-Transcripts · Voice-Support-Queue · 24/7 Radio · GitHub-Projektindex · Staff-Tools

---

## 🧩 Tech & Status

- **Sprache:** TypeScript (Node.js)
- **Library:** discord.js v14
- **Extras:** @discordjs/voice, DB (z. B. MongoDB / PostgreSQL), Express (für Webhooks)
- **Ziel:** Saubere, modulare Architektur mit Services + Commands + Events

---

## 📚 Inhaltsverzeichnis

1. [Feature-Overview](#-feature-overview)
2. [Start Here](#-start-here)
3. [User Lounge & Radio](#-user-lounge--radio)
4. [Support & Tickets](#-support--tickets)
5. [Community](#-community)
6. [Studio Projects / GitHub](#-studio-projects--github)
7. [Team (Staff)](#-team-staff)
8. [Archive & Security](#-archive--security)
9. [Persistent-Embed-System](#-persistent-embed-system)
10. [Projektstruktur](#-projektstruktur-geplant)
11. [Setup](#-setup-geplant)
12. [Roadmap](#-roadmap-auszug)
13. [Lizenz](#-lizenz)

---

## ✨ Feature-Overview

| Bereich               | Kernfunktionen                                                                                           |
|----------------------|----------------------------------------------------------------------------------------------------------|
| Start Here           | Welcome, Rules, Info, Announcements, Self-Roles                                                         |
| User Lounge          | Intro/Onboarding, 24/7 Radio im `Music` Voice-Channel                                                   |
| Support              | Tickets, HTML-Transcripts, Support-Log, Voice-Support-Queue                                             |
| Community            | Giveaways mit Slash-Commands & Buttons                                                                  |
| Studio Projects      | GitHub-Projektindex als statisches, persistentes Embed                                                  |
| Team (Staff)         | Staff Announcements, Standup, Mod-Queue, Audit-Log                                                      |
| Archive & Security   | Join/Leave-Log, AutoMod-Log, Ticket-Archive                                                             |
| Cross-Cutting System | Persistent Embeds (Single-Embed-System für Panels & Status-Overviews)                                  |

---

## 🚀 Start Here

### 👋 Welcome

- Automatisches **Welcome-Embed** bei `guildMemberAdd`
- Optional: Willkommens-DM
- Auto-Roles nach Regel-Akzept, z. B.:
  - `Verified`
  - `Member`

---

### 📜 Rules (Regelwerk)

- Regeln als **konfigurierbare Embeds**
- Ein zentrales Regel-Embed mit:
  - Klar strukturierten Sections
  - Button „**Regeln akzeptieren**“
- Beim Klick:
  - Zuweisung definierter Rollen (z. B. `Verified`, `Member`)
  - Logging der Aktion (Zeitpunkt, User)

> Das Regel-Embed wird nicht jedes Mal neu gepostet, sondern über das Persistent-Embed-System **bearbeitet**.

---

### ℹ️ Info

- Ein statisches **Info-Embed** mit:
  - Kurzbeschreibung des Servers
  - Wichtige Kategorien & Channel-Links
  - Externe Links (GitHub, Website, etc.)
- Ebenfalls als **persistentes Embed** umgesetzt.

---

### 📢 Announcements

- Slash-Commands zum Erstellen von Ankündigungen:
  - Titel, Text, optionales Bild/Thumbnail
  - Optionaler Ping von Rollen wie `Nova Updates`, `Events`, `Playtest`
- Historie ist gewünscht → **keine** Ersetzung über Persistenz, jede Ankündigung bleibt im Verlauf sichtbar.

---

### 🎭 Roles (Self-Roles)

- Rollen-Panel mit Buttons oder Select-Menü:
  - `Nova Updates`
  - `Playtest`
  - `Events`
  - `News`
- Nutzer können sich Benachrichtigungsrollen selbst zuweisen.
- Ein einziges zentrales **„Roles Panel“-Embed**, das bei Änderungen nur **editiert** wird.

---

## 🛋 User Lounge & Radio

### 🧑‍🤝‍🧑 User Lounge

- Optionales Info/Welcome-Panel in `#lobby` / `#introductions`
- Kleine Automatisierungen:
  - Erste Nachricht in `#introductions` kann automatisch begrüßt werden
  - Hinweise, wohin neue Nutzer als Nächstes gehen sollten

---

### 🎧 24/7 Radio-Musik

- Dauerhafte Musik im Voice-Channel `Music`
- Konfigurierbare Radiostream-URL (z. B. [I Love Music Streams](https://ilovemusic.de/streams))
- Geplante Commands:
  - `/radio start` – Radio im konfigurierten Voice-Channel starten
  - `/radio stop` – Radio stoppen
  - `/radio set-stream` – Radiokanal wechseln
  - `/radio status` – aktueller Status, Uptime, Hörer etc.
- Auto-Reconnect & Auto-Join nach Bot-Neustart möglich
- Optionales **Radio-Status-Embed** (persistent)

---

## 🛟 Support & Tickets

### 🎫 Ticket-System

- Ticket-Panel in `#tickets` (persistent):
  - Embed „Support & Tickets“
  - Button „Ticket eröffnen“
- Beim Klick:
  - Erstellung eines privaten Ticket-Channels / -Threads
  - Berechtigungen:
    - Ticket-Ersteller
    - Rollen `Support`, `Moderator`, `Admin`
- Geplante Commands:
  - `/ticket open`
  - `/ticket claim`
  - `/ticket add`
  - `/ticket remove`
  - `/ticket close`

---

### 📄 HTML-Transcripts

Beim Schließen eines Tickets:

1. Alle Nachrichten im Ticket werden gesammelt.
2. Es wird ein **HTML-Transkript** generiert (User, Zeit, Inhalt, Attachments als Links).
3. In `#ticket-archive` wird gepostet:
   - Embed mit Meta-Infos (Ticket-ID, Ersteller, Dauer, Supporter)
   - HTML-Datei als Attachment

Der Ticket-Status (`open` / `closed`) wird in der Datenbank gespeichert.

---

### 📊 Support-Log & Voice-Support-Queue

**Support-Log (`#support-log`):**

- Ticket erstellt / übernommen / geschlossen
- Wichtige Statusänderungen und Eskalationen

**Voice-Support-Queue:**

- Warte-Channel `support-queue`
- Mehrere Support-Voice-Channels (`Support 1–3`)
- Ablauf:
  - User joint `support-queue` → landet in einer Warteschlange (DB)
  - Supporter joint freien Support-Channel → erster wartender User wird automatisch verschoben
- Commands:
  - `/supportqueue status`
  - `/supportqueue clear`
- Optionales **Support-Queue-Status-Embed** (persistent)

---

## 🎉 Community

### 🎁 Giveaways

- Verwaltung in `#giveaways` über Slash-Commands:
  - `/giveaway create`
  - `/giveaway end`
  - `/giveaway reroll`
- Teilnahme per Button (kein Reaction-Spam)
- Teilnehmer werden in einer DB gespeichert, Gewinner per Zufall gezogen
- Optional:
  - **Giveaway-Info-Panel** (persistent), das erklärt, wie das System funktioniert

---

## 🧪 Studio Projects / GitHub

### 📂 Projektindex

- GitHub-Integration für das Profil **`PixelGG`**
- **Projektindex-Embed** in `#project-index`:
  - Auflistung aller getrackten Repositories
  - Profil-Readme-Repo (Repo mit gleichem Namen wie der User) ist explizit ausgeschlossen
  - Zeigt u. a.:
    - Repo-Name → Link
    - Kurzbeschreibung
    - Letzte Aktivität

- Aktualisierung über:
  - GitHub-Webhooks (Push, Releases, Issues, Pull Requests) oder
  - periodische API-Polls

> Das Projektindex-Embed ist **persistent** und wird nur editiert, nicht ständig neu gepostet.

---

## 🛠 Team (Staff)

### 📣 Staff Announcements

- Interne Ankündigungen via `/staffannounce create` in `#staff-announcements`
- Nur für definierte Staff-Rollen (`Owner`, `Admin`, `Dev Lead`, …)

---

### 📋 Standup

- `/standup start` generiert eine Standup-Nachricht in `#standup`
- Optional:
  - Buttons/Modals für strukturierte Antworten
- Antworten können in einer DB gespeichert und später ausgewertet werden

---

### 🚨 Mod-Queue & Audit-Log

**Mod-Queue (`#mod-queue`):**

- `/report user @User <Grund>` erzeugt ein Report-Embed:
  - Gemeldeter User
  - Melder
  - Grund
  - Link zur Original-Nachricht
- Optional: Claim-Funktion für Moderatoren

**Audit-Log (`#audit-log`):**

- Spiegel wichtiger Audit-Events:
  - Bans, Kicks
  - Role-Changes (v. a. Staff-Rollen)
  - Channel-Erstellungen / -Löschungen
  - Weitere relevante Moderationsaktionen

---

## 🛡 Archive & Security

**Join/Leave-Log (`#join-leave-log`):**

- Embeds bei Join & Leave:
  - User, ID, Account-Alter
  - Optional: verwendeter Invite

**AutoMod-Log (`#automod-log`):**

- Automatische Moderations-Events:
  - Spam, Links, Schimpfwörter, Mass-Mentions usw.
  - Maßnahme: Warn, Mute, Kick, Ban

**Ticket-Archive (`#ticket-archive`):**

- Pro Ticket:
  - Embed mit Ticket-Metadaten
  - HTML-Transkript als Datei-Anhang

---

## 🧱 Persistent-Embed-System

Ein Kern-Feature des Bots ist das **Single-Embed-/Persistent-Embed-System**, das alle statischen Panels verwaltet.

### Idee

Für jeden statischen Bereich gibt es einen eindeutigen **Key**, z. B.:

- `rules_main`
- `info_main`
- `roles_panel`
- `tickets_panel`
- `support_queue_status`
- `radio_status`
- `project_index_main`
- `giveaway_panel`

Pro Kombination `guildId + key` speichert die DB:

- `channelId`
- `messageId`
- `createdAt`
- `updatedAt`
- optional Meta-Daten

### Verhalten

- Beim Rendern eines Panels wird eine Funktion wie  
  `ensurePersistentEmbed(key, channelId, renderFn)` verwendet.
- Ablauf:
  1. Versuch, die bestehende Nachricht via `messageId` zu holen
  2. Falls vorhanden → `message.edit(renderFn())`
  3. Falls nicht vorhanden → `channel.send(renderFn())` + neue `messageId` speichern

> So bleibt pro Panel **immer genau eine Message** im Channel. Änderungen werden nur über `edit` eingespielt.

### Wird genutzt für

- Rules
- Info
- Rollen-Panel
- Ticket-Panel
- (Optional) Support-Queue-Status
- (Optional) Radio-Status
- Projektindex (GitHub)
- (Optional) Giveaway-Info

---

## 📁 Projektstruktur (geplant)

```text
arvox-studio-bot/
├─ src/
│  ├─ commands/          # Slash-Commands (roles, tickets, radio, github, giveaways, staff, ...)
│  ├─ events/            # Discord-Events (ready, interactionCreate, guildMemberAdd, voiceStateUpdate, ...)
│  ├─ services/          # TicketService, RadioService, GithubService, PersistentMessageService, ...
│  ├─ config/            # interne Konfiguration, Mapping Keys -> Channels/Rollen
│  ├─ types/             # eigene Typdefinitionen/Interfaces
│  └─ index.ts           # Einstiegspunkt
├─ config/
│  └─ default.json       # Guild-spezifische Settings (Channel/Rollen-IDs, Feature-Flags)
├─ db/ oder prisma/      # Datenbankschema/Migrations (je nach DB)
├─ .env.example          # Beispiel für ENV-Variablen (TOKEN, DB_URI, ...)
├─ .gitignore
├─ package.json
├─ tsconfig.json
└─ README.md
