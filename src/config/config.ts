import defaultConfig from './default.json';
import type { AppConfig, GuildConfig, RawConfig } from '../types/config';

export function loadConfig(): AppConfig {
  const raw = defaultConfig as unknown as RawConfig;
  if (!raw.guilds || raw.guilds.length === 0) {
    throw new Error('No guild configuration found in config/default.json');
  }

  const envGuildId = process.env.DISCORD_GUILD_ID;
  const guildsArray: GuildConfig[] = raw.guilds.map((g) => {
    if (envGuildId && g.id === 'YOUR_PRIMARY_GUILD_ID_HERE') {
      return { ...g, id: envGuildId };
    }
    return g;
  });

  const primaryGuildId = envGuildId ?? guildsArray[0].id;
  if (!primaryGuildId) {
    throw new Error('DISCORD_GUILD_ID is not set and no fallback guild id is configured.');
  }

  const guilds: Record<string, GuildConfig> = {};
  for (const guild of guildsArray) {
    guilds[guild.id] = guild;
  }

  if (!guilds[primaryGuildId]) {
    throw new Error(
      `Primary guild id ${primaryGuildId} is not present in config/default.json. Please update the config.`
    );
  }

  return {
    defaultGuildId: primaryGuildId,
    guilds
  };
}

