import type {
  ChatInputCommandInteraction,
  PermissionResolvable,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder
} from 'discord.js';
import type { AppConfig } from './config';

export interface SlashCommand {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder;
  guildOnly?: boolean;
  requiredPermissions?: PermissionResolvable[];
  requiredRoleKeys?: string[];
  execute: (interaction: ChatInputCommandInteraction, config: AppConfig) => Promise<void>;
}
