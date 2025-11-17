import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import type { SlashCommand } from './types/commands';
import { loadConfig } from './config/config';
import { connectDatabase } from './db/connection';
import { registerEvents } from './events';
import { CommandDeployer } from './services/CommandDeployer';
import { loadSlashCommands } from './utils/commandLoader';

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, SlashCommand>;
  }
}

async function bootstrap() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error('DISCORD_TOKEN is not set. Please configure your .env file.');
  }

  const appConfig = loadConfig();
  await connectDatabase(process.env.DATABASE_URL);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User]
  }) as Client & { commands: Collection<string, SlashCommand> };

  client.commands = new Collection();

  const commands = await loadSlashCommands();
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }

  await registerEvents(client, appConfig);

  const deployer = new CommandDeployer(appConfig);
  await deployer.registerGuildCommands(commands);

  await client.login(token);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
