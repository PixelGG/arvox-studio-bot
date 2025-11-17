import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type VoiceChannel
} from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';
import { RadioService } from '../../services/RadioService';
import { PersistentMessageService } from '../../services/PersistentMessageService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('24/7 Radio im Voice-Channel steuern')
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Radio im Voice-Channel starten')
        .addChannelOption((opt) =>
          opt
            .setName('voice_channel')
            .setDescription('Voice-Channel für das Radio (optional)')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('preset')
            .setDescription('Optionaler Preset-Name aus der Konfiguration')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('stop').setDescription('Radio stoppen und Voice-Channel verlassen')
    )
    .addSubcommand((sub) =>
      sub
        .setName('set-stream')
        .setDescription('Stream-URL oder Preset für das Radio setzen')
        .addStringOption((opt) =>
          opt
            .setName('preset')
            .setDescription('Preset-Name aus der Konfiguration')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('url')
            .setDescription('Direkte Stream-URL')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Aktuellen Radio-Status anzeigen')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect),
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
    if (!guildConfig || !guildConfig.music.enabled) {
      await interaction.reply({
        content: 'Radio ist für diesen Server nicht aktiviert.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'status') {
      const embed = RadioService.getStatusEmbed(interaction.guild, config);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Nur Staff darf Radio starten/stoppen/konfigurieren
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
      guildConfig.roles.owner,
      guildConfig.roles.devLead
    ];

    const rolesManager = 'roles' in member ? (member.roles as any) : null;
    const hasStaffRole =
      rolesManager != null && staffRoleIds.some((id) => rolesManager.cache.has(id));
    if (!hasStaffRole) {
      await interaction.reply({
        content: 'Dieser Subcommand ist nur für Staff-Rollen verfügbar.',
        ephemeral: true
      });
      return;
    }

    if (sub === 'start') {
      const channelOption = interaction.options.getChannel('voice_channel') as VoiceChannel | null;
      const preset = interaction.options.getString('preset');

      const voiceChannelId =
        channelOption?.id ?? guildConfig.music.voiceChannelId;

      const presetUrl =
        preset && guildConfig.music.presets[preset]
          ? guildConfig.music.presets[preset]
          : undefined;

      const streamUrl = presetUrl ?? guildConfig.music.streamUrl;

      await RadioService.start(interaction.client, guildId, voiceChannelId, streamUrl);
      await interaction.reply({
        content: `Radio gestartet in <#${voiceChannelId}> mit Stream ${streamUrl}.`,
        ephemeral: true
      });
    } else if (sub === 'stop') {
      await RadioService.stop(guildId);
      await interaction.reply({
        content: 'Radio gestoppt.',
        ephemeral: true
      });
    } else if (sub === 'set-stream') {
      const preset = interaction.options.getString('preset');
      const url = interaction.options.getString('url');

      let streamUrl: string | undefined;

      if (url) {
        streamUrl = url;
      } else if (preset && guildConfig.music.presets[preset]) {
        streamUrl = guildConfig.music.presets[preset];
      }

      if (!streamUrl) {
        await interaction.reply({
          content: 'Bitte gib entweder eine gültige URL oder einen bekannten Preset-Namen an.',
          ephemeral: true
        });
        return;
      }

      await RadioService.setStream(
        interaction.client,
        guildId,
        streamUrl,
        guildConfig.music.voiceChannelId
      );

      await interaction.reply({
        content: `Radio-Stream aktualisiert: ${streamUrl}`,
        ephemeral: true
      });
    }

    // Optional: persistentes Radio-Status-Embed aktualisieren
    await PersistentMessageService.ensurePersistentMessage(
      interaction.client,
      guildId,
      'radio_status',
      guildConfig.channels.info,
      () => {
        const embed = RadioService.getStatusEmbed(interaction.guild!, config);
        return { embeds: [embed] };
      }
    );
  }
};

export default command;
