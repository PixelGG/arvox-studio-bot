import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type VoiceChannel
} from 'discord.js';
import type { SlashCommand } from '../../types/commands';
import type { AppConfig, GuildConfig } from '../../types/config';
import { RadioService } from '../../services/RadioService';
import { MusicQueueService } from '../../services/MusicQueueService';
import { LoggingService } from '../../services/LoggingService';

function getGuildConfig(config: AppConfig, guildId?: string | null): GuildConfig | undefined {
  if (!guildId) return undefined;
  return config.guilds[guildId];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Musik Queue steuern (On-Demand)')
    .addSubcommand((sub) =>
      sub
        .setName('play')
        .setDescription('Track/Stream URL in die Queue')
        .addStringOption((opt) =>
          opt.setName('url').setDescription('Stream/Track URL').setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('voice_channel')
            .setDescription('Voice-Channel (optional)')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName('skip').setDescription('Naechsten Track spielen'))
    .addSubcommand((sub) => sub.setName('queue').setDescription('Queue anzeigen'))
    .addSubcommand((sub) => sub.setName('stop').setDescription('Musik stoppen & Queue leeren'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect),
  guildOnly: true,
  async execute(interaction, config: AppConfig) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId || !interaction.guild) {
      await interaction.reply({ content: 'Nur im Server nutzbar.', ephemeral: true });
      return;
    }

    const guildConfig = getGuildConfig(config, guildId);
    if (!guildConfig || !guildConfig.music.enabled) {
      await interaction.reply({ content: 'Musik ist nicht aktiviert.', ephemeral: true });
      return;
    }

    // Staff permission similar zu /radio
    const member = interaction.member;
    const staffRoleIds = [
      guildConfig.roles.support,
      guildConfig.roles.moderator,
      guildConfig.roles.admin,
      guildConfig.roles.owner,
      guildConfig.roles.devLead
    ];
    const rolesManager = member && 'roles' in member ? (member as any).roles : null;
    const hasStaff =
      rolesManager != null && staffRoleIds.some((id) => rolesManager.cache.has(id));

    if (!hasStaff) {
      await interaction.reply({ content: 'Nur Staff darf Musik steuern.', ephemeral: true });
      return;
    }

    if (sub === 'play') {
      const url = interaction.options.getString('url', true);
      const channelOption = interaction.options.getChannel('voice_channel') as VoiceChannel | null;
      const voiceChannelId = channelOption?.id ?? guildConfig.music.voiceChannelId;

      const track = MusicQueueService.enqueue(guildId, {
        title: url,
        url,
        requestedBy: interaction.user.id
      });

      const current = MusicQueueService.getCurrent(guildId);
      if (!current) {
        // start immediately
        MusicQueueService.next(guildId);
        await RadioService.start(interaction.client, guildId, voiceChannelId, url);
      }

      await interaction.reply({ content: `Track zur Queue hinzugefügt: ${url}`, ephemeral: true });
      await LoggingService.logAuditEvent(
        interaction.guild,
        config,
        'Musik Play',
        `${interaction.user.tag} hat ${url} in die Queue gelegt.`
      );
      return;
    }

    if (sub === 'skip') {
      const next = MusicQueueService.next(guildId);
      if (next) {
        await RadioService.setStream(
          interaction.client,
          guildId,
          next.url,
          guildConfig.music.voiceChannelId
        );
        await interaction.reply({ content: `Spiele jetzt: ${next.title}`, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Keine weiteren Tracks in der Queue.', ephemeral: true });
      }
      return;
    }

    if (sub === 'queue') {
      const current = MusicQueueService.getCurrent(guildId);
      const queue = MusicQueueService.getQueue(guildId);
      const lines: string[] = [];
      if (current) {
        lines.push(`Aktuell: ${current.title}`);
      }
      if (queue.length) {
        lines.push(
          'Nächste:',
          ...queue.slice(0, 10).map((t, idx) => `${idx + 1}. ${t.title} (von <@${t.requestedBy}>)`)
        );
      }
      if (!lines.length) {
        lines.push('Queue ist leer.');
      }
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
      return;
    }

    if (sub === 'stop') {
      MusicQueueService.clear(guildId);
      await RadioService.stop(guildId);
      await interaction.reply({ content: 'Musik gestoppt und Queue geleert.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Unbekannter Subcommand.', ephemeral: true });
  }
};

export default command;
