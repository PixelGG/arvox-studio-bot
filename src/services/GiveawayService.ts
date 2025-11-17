import { randomInt } from 'node:crypto';
import type {
  Client,
  TextChannel,
  ButtonInteraction,
  ChatInputCommandInteraction
} from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { nanoid } from 'nanoid';
import type { AppConfig, GuildConfig } from '../types/config';
import { GiveawayModel } from '../db/models/Giveaway';

interface GiveawayTimer {
  timeout: NodeJS.Timeout;
}

export class GiveawayService {
  private static timers = new Map<string, GiveawayTimer>();

  private static getGuildConfig(config: AppConfig, guildId: string): GuildConfig | undefined {
    return config.guilds[guildId];
  }

  static async createGiveaway(
    interaction: ChatInputCommandInteraction,
    config: AppConfig
  ): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId || !interaction.guild) {
      await interaction.reply({
        content: 'Dieser Command kann nur in einem Server verwendet werden.',
        ephemeral: true
      });
      return;
    }

    const guildConfig = this.getGuildConfig(config, guildId);
    if (!guildConfig) {
      await interaction.reply({ content: 'Keine Guild-Konfiguration gefunden.', ephemeral: true });
      return;
    }

    const prize = interaction.options.getString('prize', true);
    const winnerCount = interaction.options.getInteger('winners', true);
    const durationMinutes = interaction.options.getInteger('duration_minutes', true);
    const channel = (interaction.options.getChannel('channel') ??
      interaction.guild.channels.cache.get(guildConfig.giveaways.defaultChannelId)) as TextChannel | null;

    if (!channel || !channel.isTextBased()) {
      await interaction.reply({ content: 'Ziel-Channel ist ungültig.', ephemeral: true });
      return;
    }

    const id = nanoid(8);
    const endAt = new Date(Date.now() + durationMinutes * 60_000);

    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway')
      .setDescription(prize)
      .addFields(
        { name: 'Host', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Gewinner', value: winnerCount.toString(), inline: true },
        { name: 'Endet', value: `<t:${Math.floor(endAt.getTime() / 1000)}:R>`, inline: true }
      )
      .setTimestamp(new Date());

    const button = new ButtonBuilder()
      .setCustomId(`giveaway_join:${id}`)
      .setLabel('Teilnehmen')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    const message = await channel.send({ embeds: [embed], components: [row] });

    await GiveawayModel.create({
      id,
      guildId,
      channelId: channel.id,
      messageId: message.id,
      prize,
      winnerCount,
      hostId: interaction.user.id,
      status: 'running',
      endAt,
      participants: []
    });

    this.scheduleEnd(interaction.client, id, endAt);

    await interaction.reply({
      content: `Giveaway erstellt in ${channel}.`,
      ephemeral: true
    });
  }

  static async handleJoinButton(interaction: ButtonInteraction): Promise<void> {
    const [prefix, id] = interaction.customId.split(':');
    if (prefix !== 'giveaway_join' || !id) return;

    const giveaway = await GiveawayModel.findOne({ id }).exec();
    if (!giveaway) {
      await interaction.reply({
        content: 'Dieses Giveaway existiert nicht mehr.',
        ephemeral: true
      });
      return;
    }

    if (giveaway.status !== 'running') {
      await interaction.reply({
        content: 'Dieses Giveaway ist bereits beendet.',
        ephemeral: true
      });
      return;
    }

    const index = giveaway.participants.indexOf(interaction.user.id);
    let action: 'joined' | 'left';
    if (index === -1) {
      giveaway.participants.push(interaction.user.id);
      action = 'joined';
    } else {
      giveaway.participants.splice(index, 1);
      action = 'left';
    }

    await giveaway.save();
    await interaction.reply({
      content:
        action === 'joined'
          ? 'Du nimmst nun am Giveaway teil.'
          : 'Du nimmst nicht mehr am Giveaway teil.',
      ephemeral: true
    });
  }

  static async endGiveawayByCommand(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const id = interaction.options.getString('id', true);
    const result = await this.endGiveaway(interaction.client, id);

    if (!result) {
      await interaction.reply({
        content: 'Giveaway wurde nicht gefunden oder ist bereits beendet.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({ content: 'Giveaway beendet.', ephemeral: true });
  }

  static async reroll(interaction: ChatInputCommandInteraction): Promise<void> {
    const id = interaction.options.getString('id', true);
    if (!id) {
      await interaction.reply({
        content: 'Bitte eine gültige Giveaway-ID angeben.',
        ephemeral: true
      });
      return;
    }

    const giveaway = await GiveawayModel.findOne({ id }).exec();
    if (!giveaway || giveaway.status !== 'ended') {
      await interaction.reply({
        content: 'Dieses Giveaway ist nicht beendet oder existiert nicht.',
        ephemeral: true
      });
      return;
    }

    const winners = this.pickWinners(giveaway.participants, giveaway.winnerCount);
    const channel = (await interaction.client.channels.fetch(
      giveaway.channelId
    )) as TextChannel | null;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (message) {
        const embed = message.embeds[0]
          ? EmbedBuilder.from(message.embeds[0])
          : new EmbedBuilder().setTitle('🎉 Giveaway');

        embed.addFields({
          name: 'Neue Gewinner (Reroll)',
          value: winners.length
            ? winners.map((id) => `<@${id}>`).join(', ')
            : 'Keine Gewinner, zu wenige Teilnehmer.'
        });

        await message.edit({ embeds: [embed], components: [] });
      }
    }

    await interaction.reply({
      content: winners.length
        ? `Neue Gewinner: ${winners.map((id) => `<@${id}>`).join(', ')}`
        : 'Kein Gewinner, zu wenige Teilnehmer.',
      ephemeral: true
    });
  }

  static async resumeRunningGiveaways(client: Client): Promise<void> {
    const giveaways = await GiveawayModel.find({ status: 'running' }).exec();
    const now = new Date();

    for (const giveaway of giveaways) {
      if (giveaway.endAt <= now) {
        void this.endGiveaway(client, giveaway.id);
      } else {
        this.scheduleEnd(client, giveaway.id, giveaway.endAt);
      }
    }
  }

  private static scheduleEnd(client: Client, id: string, endAt: Date): void {
    const delay = Math.max(0, endAt.getTime() - Date.now());
    const timeout = setTimeout(() => {
      void this.endGiveaway(client, id);
    }, delay);

    this.timers.set(id, { timeout });
  }

  private static async endGiveaway(client: Client, id: string): Promise<boolean> {
    const giveaway = await GiveawayModel.findOne({ id }).exec();
    if (!giveaway || giveaway.status === 'ended') return false;

    this.timers.get(id)?.timeout.unref();
    this.timers.delete(id);

    giveaway.status = 'ended';
    await giveaway.save();

    const winners = this.pickWinners(giveaway.participants, giveaway.winnerCount);

    const channel = (await client.channels.fetch(
      giveaway.channelId
    )) as TextChannel | null;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (message) {
        const embed = message.embeds[0]
          ? EmbedBuilder.from(message.embeds[0])
          : new EmbedBuilder().setTitle('🎉 Giveaway');

        embed.addFields({
          name: 'Gewinner',
          value: winners.length
            ? winners.map((id) => `<@${id}>`).join(', ')
            : 'Keine Gewinner, zu wenige Teilnehmer.'
        });

        await message.edit({ embeds: [embed], components: [] });
      }
    }

    if (winners.length && channel) {
      await channel.send({
        content: `Herzlichen Glückwunsch ${winners.map((id) => `<@${id}>`).join(', ')}!`
      });
    }

    return true;
  }

  private static pickWinners(participants: string[], winnerCount: number): string[] {
    if (participants.length === 0 || winnerCount <= 0) return [];
    const pool = [...participants];
    const winners: string[] = [];

    while (winners.length < winnerCount && pool.length > 0) {
      const index = randomInt(pool.length);
      winners.push(pool.splice(index, 1)[0] as string);
    }

    return winners;
  }
}

