import { PermissionFlagsBits, SlashCommandBuilder, type GuildMember } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';
import { ModuleService } from '../../services/ModuleService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Konfigurations- und Modul-Health-Pruefung')
    .addSubcommand((sub) =>
      sub.setName('check').setDescription('Prueft Module auf fehlende Channels/Rollen/Settings')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  async execute(interaction, config: AppConfig) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'check') {
      await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
      return;
    }

    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: 'Nur in einem Server verfuegbar.', ephemeral: true });
      return;
    }

    const guildConfig = getGuildConfig(config, interaction.guildId);
    if (!guildConfig) {
      await interaction.reply({ content: 'Keine Guild-Konfiguration gefunden.', ephemeral: true });
      return;
    }

    // Minimal health: check configured channels/roles exist
    const missingChannels: string[] = [];
    const missingRoles: string[] = [];

    for (const [key, id] of Object.entries(guildConfig.channels)) {
      const ch = interaction.guild.channels.cache.get(id);
      if (!ch) missingChannels.push(`${key} (${id})`);
    }

    for (const [key, id] of Object.entries(guildConfig.roles)) {
      const role = interaction.guild.roles.cache.get(id);
      if (!role) missingRoles.push(`${key} (${id})`);
    }

    const health = await ModuleService.evaluateHealth(interaction.guildId);

    const lines: string[] = [];
    lines.push(`Module: ${health.length ? health.map((h) => `${h.moduleKey}:${h.status}`).join(', ') : 'keine'}`);
    if (missingChannels.length) {
      lines.push(`Fehlende Channels: ${missingChannels.join(', ')}`);
    }
    if (missingRoles.length) {
      lines.push(`Fehlende Rollen: ${missingRoles.join(', ')}`);
    }
    if (!missingChannels.length && !missingRoles.length) {
      lines.push('Basis-Konfiguration OK.');
    }

    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
  }
};

export default command;
