import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';
import { PersistentMessageService } from '../../services/PersistentMessageService';
import { TicketService } from '../../services/TicketService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket-System verwalten')
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Ticket-Panel als persistente Nachricht posten/aktualisieren')
    )
    .addSubcommand((sub) =>
      sub
        .setName('open')
        .setDescription('Ein neues Ticket eroeffnen')
        .addStringOption((opt) =>
          opt.setName('topic').setDescription('Kurze Beschreibung des Anliegens').setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('type').setDescription('Ticket-Typ/Workflow').setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('sla_minutes')
            .setDescription('SLA in Minuten')
            .setMinValue(5)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('claim').setDescription('Ticket uebernehmen (Supporter)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('User oder Rolle zum Ticket hinzufuegen')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User, der hinzugefuegt werden soll').setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Rolle, die hinzugefuegt werden soll').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('User oder Rolle aus dem Ticket entfernen')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User, der entfernt werden soll').setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Rolle, die entfernt werden soll').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Ticket schliessen und Transcript erstellen')
        .addStringOption((opt) =>
          opt.setName('reason').setDescription('Optionaler Grund').setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  guildOnly: true,
  async execute(interaction, config: AppConfig) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId || !interaction.guild) {
      await interaction.reply({
        content: 'Dieser Command kann nur in einem Server verwendet werden.',
        ephemeral: true
      });
      return;
    }

    const guildConfig = getGuildConfig(config, guildId);
    if (!guildConfig) {
      await interaction.reply({
        content: 'Keine Guild-Konfiguration gefunden.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'panel') {
      await PersistentMessageService.ensurePersistentMessage(
        interaction.client,
        guildId,
        'tickets_panel',
        guildConfig.tickets.panelChannelId,
        () => ({
          embeds: [
            {
              title: 'Support & Tickets',
              description:
                'Klicke auf den Button, um ein neues Support-Ticket zu eroeffnen. Ein Mitglied des Teams meldet sich so schnell wie moeglich bei dir.',
              fields: [
                {
                  name: 'Hinweis',
                  value:
                    'Bitte beschreibe dein Problem so detailliert wie moeglich und halte relevante Informationen bereit.'
                }
              ],
              timestamp: new Date().toISOString()
            }
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  custom_id: 'ticket_open',
                  label: 'Ticket eroeffnen',
                  style: 1
                }
              ]
            }
          ]
        })
      );

      await interaction.reply({
        content: 'Ticket-Panel wurde gepostet/aktualisiert.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'open') {
      await TicketService.createTicketFromCommand(interaction, config);
      return;
    }

    // Ab hier: nur fuer Support-/Staff-Rollen
    const member = interaction.member;
    if (!member || !('roles' in member)) {
      await interaction.reply({
        content: 'Fehlende Berechtigung.',
        ephemeral: true
      });
      return;
    }

    const staffRoleIds = [
      guildConfig.roles.support,
      guildConfig.roles.moderator,
      guildConfig.roles.admin,
      guildConfig.roles.owner
    ];

    const rolesManager = 'roles' in member ? (member.roles as any) : null;
    const hasStaffRole =
      rolesManager != null && staffRoleIds.some((id) => rolesManager.cache.has(id));
    if (!hasStaffRole) {
      await interaction.reply({
        content: 'Dieser Subcommand ist nur fuer Support-/Staff-Rollen verfuegbar.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'claim') {
      await TicketService.claimTicket(interaction, config);
      return;
    }

    if (sub === 'add') {
      await TicketService.addParticipant(interaction, config);
      return;
    }

    if (sub === 'remove') {
      await TicketService.removeParticipant(interaction, config);
      return;
    }

    if (sub === 'close') {
      await TicketService.closeTicket(interaction, config);
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;
