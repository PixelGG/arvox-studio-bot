import type {
  ButtonInteraction,
  CommandInteraction,
  GuildMember,
  Interaction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction
} from 'discord.js';
import { Collection } from 'discord.js';
import type { DiscordEvent } from '../types/events';
import type { AppConfig, GuildConfig, RoleConfig } from '../types/config';
import type { SlashCommand } from '../types/commands';
import { TicketService } from '../services/TicketService';
import { GiveawayService } from '../services/GiveawayService';
import { StandupService } from '../services/StandupService';
import { LoggingService } from '../services/LoggingService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

function hasRequiredRoles(
  member: GuildMember,
  roleKeys: string[] | undefined,
  rolesConfig: RoleConfig | undefined
): boolean {
  if (!roleKeys || roleKeys.length === 0 || !rolesConfig) return true;

  // At least one of the configured roles must be present
  return roleKeys.some((key) => {
    const roleId = (rolesConfig as any)[key] as string | undefined;
    return roleId ? member.roles.cache.has(roleId) : false;
  });
}

async function handleChatInputCommand(
  interaction: CommandInteraction,
  config: AppConfig
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const client = interaction.client as typeof interaction.client & {
    commands?: Collection<string, SlashCommand>;
  };

  const command = client.commands?.get(interaction.commandName);
  if (!command) return;

  const guildConfig = getGuildConfig(config, interaction.guildId);

  if (command.guildOnly && !interaction.inGuild()) {
    await interaction.reply({
      content: 'Dieser Command kann nur in einem Server verwendet werden.',
      ephemeral: true
    });
    return;
  }

  if (interaction.inGuild()) {
    const member = interaction.member as GuildMember;

    if (command.requiredPermissions && !member.permissions.has(command.requiredPermissions)) {
      await interaction.reply({
        content: 'Du hast keine Berechtigung, diesen Command auszuführen.',
        ephemeral: true
      });
      return;
    }

    if (
      command.requiredRoleKeys &&
      !hasRequiredRoles(member, command.requiredRoleKeys, guildConfig?.roles)
    ) {
      await interaction.reply({
        content: 'Du hast nicht die erforderliche Rolle, um diesen Command zu nutzen.',
        ephemeral: true
      });
      return;
    }
  }

  try {
    await command.execute(interaction, config);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error while executing command', error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'Beim Ausführen dieses Commands ist ein Fehler aufgetreten.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'Beim Ausführen dieses Commands ist ein Fehler aufgetreten.',
        ephemeral: true
      });
    }
  }
}

async function handleButtonInteraction(
  interaction: ButtonInteraction,
  config: AppConfig
): Promise<void> {
  const guildConfig = getGuildConfig(config, interaction.guildId);

  if (interaction.customId === 'rules_accept') {
    if (!interaction.inGuild() || !guildConfig) {
      await interaction.reply({
        content: 'Regel-Akzept ist nur innerhalb eines Servers möglich.',
        ephemeral: true
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const rolesToAdd = guildConfig.rules.acceptRoles.filter(
      (roleId) => !member.roles.cache.has(roleId)
    );

    if (rolesToAdd.length === 0) {
      await interaction.reply({
        content: 'Du hast die Regeln bereits akzeptiert.',
        ephemeral: true
      });
      return;
    }

    await member.roles.add(rolesToAdd);

    const { RuleAcceptanceModel } = await import('../db/models/RuleAcceptance');
    const { AutoRoleRuleModel } = await import('../db/models/AutoRoleRule');

    await RuleAcceptanceModel.findOneAndUpdate(
      { guildId: interaction.guildId, userId: interaction.user.id },
      { guildId: interaction.guildId, userId: interaction.user.id, acceptedAt: new Date() },
      { upsert: true }
    ).exec();

    if (interaction.guild) {
      const autoRules = await AutoRoleRuleModel.find({
        guildId: interaction.guildId,
        condition: 'after_accept',
        enabled: true
      }).exec();

      for (const rule of autoRules) {
        const role = interaction.guild.roles.cache.get(rule.roleId);
        if (role && !member.roles.cache.has(role.id)) {
          await member.roles.add(role).catch(() => null);
        }
      }
    }

    await interaction.reply({
      content: 'Regeln akzeptiert. Rollen wurden vergeben.',
      ephemeral: true
    });

    await LoggingService.logAuditEvent(
      member.guild,
      config,
      'Regeln akzeptiert',
      `${member.user.tag} (${member.id}) hat die Regeln akzeptiert und Rollen erhalten.`
    );
    return;
  }

  if (interaction.customId === 'ticket_open') {
    await TicketService.createTicketFromButton(interaction, config);
    return;
  }

  if (interaction.customId.startsWith('giveaway_join:')) {
    await GiveawayService.handleJoinButton(interaction);
    return;
  }

  if (interaction.customId === 'standup_open_modal') {
    await StandupService.openStandupModal(interaction);
    return;
  }
}

async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
  config: AppConfig
): Promise<void> {
  if (interaction.customId !== 'roles_panel_select') return;
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({
      content: 'Rollen können nur innerhalb eines Servers angepasst werden.',
      ephemeral: true
    });
    return;
  }

  const guildConfig = getGuildConfig(config, interaction.guildId);
  if (!guildConfig) {
    await interaction.reply({
      content: 'Keine Guild-Konfiguration gefunden.',
      ephemeral: true
    });
    return;
  }

  const member = interaction.member as GuildMember;
  const selected = new Set(interaction.values);
  const max = guildConfig.rolesPanel.maxSelections ?? guildConfig.rolesPanel.options.length;
  if (selected.size > max) {
    await interaction.reply({
      content: `Du darfst maximal ${max} Rollen auswählen.`,
      ephemeral: true
    });
    return;
  }

  const added: string[] = [];
  const removed: string[] = [];

  for (const option of guildConfig.rolesPanel.options) {
    const hasRole = member.roles.cache.has(option.roleId);
    const shouldHave = selected.has(option.roleId);

    if (!hasRole && shouldHave) {
      await member.roles.add(option.roleId);
      added.push(option.label);
    } else if (hasRole && !shouldHave) {
      await member.roles.remove(option.roleId);
      removed.push(option.label);
    }
  }

  const lines: string[] = [];
  if (added.length) {
    lines.push(`Hinzugefügt: ${added.join(', ')}`);
  }
  if (removed.length) {
    lines.push(`Entfernt: ${removed.join(', ')}`);
  }

  await interaction.reply({
    content: lines.length ? lines.join('\n') : 'Keine Änderungen an deinen Rollen.',
    ephemeral: true
  });
}

async function handleModalSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  if (interaction.customId === 'standup_modal') {
    await StandupService.handleStandupModalSubmit(interaction);
  }
  if (interaction.customId === 'onboarding_modal') {
    await (await import('../services/OnboardingService')).OnboardingService.handleSubmit(interaction);
  }
}

const event: DiscordEvent = {
  name: 'interactionCreate',
  async execute(_client, config, ...args: unknown[]) {
    const [interaction] = args as [Interaction];

    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(interaction, config);
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction, config);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction, config);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  }
};

export default event;
