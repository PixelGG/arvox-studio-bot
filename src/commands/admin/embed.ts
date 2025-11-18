import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';
import { EmbedSessionService } from '../../services/EmbedSessionService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Web-Editor-Link für Embeds erstellen')
    .addSubcommand((sub) =>
      sub
        .setName('session')
        .setDescription('Eine neue Embed-Editor-Session erstellen (nur Staff)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  requiredRoleKeys: ['owner', 'admin', 'devLead'],
  async execute(interaction, config: AppConfig) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'session') {
      await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
      return;
    }

    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: 'Dieser Command kann nur in einem Server verwendet werden.',
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

    const session = EmbedSessionService.createSession(
      interaction.guildId,
      interaction.user.tag,
      60
    );

    const port = Number(process.env.PORT ?? 3000);
    const baseUrl =
      process.env.EMBED_BASE_URL ??
      (process.env.NODE_ENV === 'production'
        ? `http://localhost:${port}`
        : `http://localhost:${port}`);

    const url = `${baseUrl}/embed/${session.code}`;

    await interaction.reply({
      content:
        `Embed-Editor-Session erstellt.\n\n` +
        `Link (gültig ca. 60 Minuten):\n` +
        `${url}\n\n` +
        `Nur weitergeben, wenn die Person Embeds im Namen des Bots posten darf.`,
      ephemeral: true
    });
  }
};

export default command;

