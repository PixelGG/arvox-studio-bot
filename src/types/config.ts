export interface ChannelConfig {
  welcome: string;
  rules: string;
  info: string;
  roles: string;
  announcements: string;
  tickets: string;
  support: string;
  supportLog: string;
  ticketArchive: string;
  giveaways: string;
  projectIndex: string;
  staffAnnouncements: string;
  modQueue: string;
  auditLog: string;
  joinLeaveLog: string;
  automodLog: string;
  standup: string;
}

export interface RoleConfig {
  owner: string;
  admin: string;
  devLead: string;
  support: string;
  moderator: string;
  member: string;
  verified: string;
  muted: string;
  novaUpdates: string;
  playtest: string;
  events: string;
  news: string;
}

export interface WelcomeConfig {
  enabled: boolean;
  channelId: string;
  autoRoles: string[];
  dmEnabled: boolean;
}

export interface RulesSectionConfig {
  title: string;
  description: string;
  order: number;
}

export interface RulesConfig {
  channelId: string;
  acceptRoles: string[];
  sections: RulesSectionConfig[];
}

export interface InfoConfig {
  channelId: string;
  description: string;
  links: { label: string; url: string }[];
}

export interface RolesPanelOptionConfig {
  label: string;
  description: string;
  roleId: string;
}

export interface RolesPanelConfig {
  channelId: string;
  options: RolesPanelOptionConfig[];
  maxSelections?: number;
}

export interface MusicConfig {
  enabled: boolean;
  voiceChannelId: string;
  streamUrl: string;
  streamName?: string;
  presets: Record<string, string>;
}

export interface GithubConfig {
  username: string;
  ignoredRepos: string[];
  channelId: string;
  trackAllPublicRepos: boolean;
  trackedRepos: string[];
  pollingIntervalMinutes: number;
}

export interface SupportQueueConfig {
  enabled: boolean;
  queueVoiceChannelId: string;
  supportVoiceChannelIds: string[];
  statusMessageChannelId?: string;
}

export interface TicketsConfig {
  panelChannelId: string;
  categoryId: string;
  supportLogChannelId: string;
  ticketArchiveChannelId: string;
  useThreads: boolean;
}

export interface GiveawaysConfig {
  defaultChannelId: string;
}

export interface LoggingConfig {
  joinLeaveChannelId: string;
  automodChannelId: string;
  auditChannelId: string;
  supportLogChannelId: string;
  ticketArchiveChannelId: string;
}

export interface StandupConfig {
  channelId: string;
}

export interface GuildFeatureConfig {
  welcome: WelcomeConfig;
  rules: RulesConfig;
  info: InfoConfig;
  rolesPanel: RolesPanelConfig;
  music: MusicConfig;
  github: GithubConfig;
  supportQueue: SupportQueueConfig;
  tickets: TicketsConfig;
  giveaways: GiveawaysConfig;
  logging: LoggingConfig;
  standup: StandupConfig;
}

export interface GuildConfig extends GuildFeatureConfig {
  id: string;
  channels: ChannelConfig;
  roles: RoleConfig;
}

export interface AppConfig {
  defaultGuildId: string;
  guilds: Record<string, GuildConfig>;
}

export interface RawConfig {
  guilds: GuildConfig[];
}
