import type { Client } from 'discord.js';
import { GuildModuleModel, type GuildModuleDocument } from '../db/models/GuildModule';
import { ModuleDefinitionModel, type ModuleDefinitionDocument } from '../db/models/ModuleDefinition';
import { PermissionProfileModel, type PermissionProfileDocument } from '../db/models/PermissionProfile';
import { ConfigProfileModel, type ConfigProfileDocument } from '../db/models/ConfigProfile';

export interface ModuleHealthResult {
  moduleKey: string;
  status: 'ok' | 'warning' | 'error';
  message?: string;
}

export class ModuleService {
  static async listDefinitions(): Promise<ModuleDefinitionDocument[]> {
    return ModuleDefinitionModel.find({}).exec();
  }

  static async upsertDefinition(def: Partial<ModuleDefinitionDocument>): Promise<void> {
    if (!def.moduleKey || !def.label) {
      throw new Error('moduleKey and label are required');
    }
    await ModuleDefinitionModel.findOneAndUpdate(
      { moduleKey: def.moduleKey },
      {
        moduleKey: def.moduleKey,
        label: def.label,
        description: def.description,
        version: def.version ?? '1.0.0',
        dependencies: def.dependencies ?? []
      },
      { upsert: true }
    ).exec();
  }

  static async getGuildModules(guildId: string): Promise<GuildModuleDocument[]> {
    return GuildModuleModel.find({ guildId }).exec();
  }

  static async setGuildModuleState(
    guildId: string,
    moduleKey: string,
    enabled: boolean,
    settings?: Record<string, unknown>
  ): Promise<GuildModuleDocument> {
    return GuildModuleModel.findOneAndUpdate(
      { guildId, moduleKey },
      {
        guildId,
        moduleKey,
        enabled,
        ...(settings ? { settings } : {})
      },
      { upsert: true, new: true }
    ).exec();
  }

  static async evaluateHealth(
    guildId: string
  ): Promise<ModuleHealthResult[]> {
    const modules = await this.getGuildModules(guildId);
    return modules.map((mod) => ({
      moduleKey: mod.moduleKey,
      status: mod.healthStatus === 'disabled' ? 'warning' : (mod.healthStatus as 'ok' | 'warning' | 'error'),
      message: mod.healthMessage
    }));
  }

  static async setHealth(
    guildId: string,
    moduleKey: string,
    status: 'ok' | 'warning' | 'error',
    message?: string
  ): Promise<void> {
    await GuildModuleModel.findOneAndUpdate(
      { guildId, moduleKey },
      {
        guildId,
        moduleKey,
        healthStatus: status,
        healthMessage: message,
        lastCheckedAt: new Date()
      },
      { upsert: true }
    ).exec();
  }

  // Permission profiles
  static async listPermissionProfiles(guildId: string): Promise<PermissionProfileDocument[]> {
    return PermissionProfileModel.find({ guildId }).exec();
  }

  static async upsertPermissionProfile(params: {
    guildId: string;
    profileKey: string;
    label: string;
    roleIds: string[];
    actions: Record<string, string[]>;
  }): Promise<PermissionProfileDocument> {
    const { guildId, profileKey, label, roleIds, actions } = params;
    return PermissionProfileModel.findOneAndUpdate(
      { guildId, profileKey },
      { guildId, profileKey, label, roleIds, actions },
      { upsert: true, new: true }
    ).exec();
  }

  static async deletePermissionProfile(guildId: string, profileKey: string): Promise<void> {
    await PermissionProfileModel.deleteOne({ guildId, profileKey }).exec();
  }

  // Config profiles
  static async listConfigProfiles(guildId: string): Promise<ConfigProfileDocument[]> {
    return ConfigProfileModel.find({ guildId }).exec();
  }

  static async createConfigProfile(params: {
    guildId: string;
    name: string;
    description?: string;
    snapshot: Record<string, unknown>;
    isActive?: boolean;
  }): Promise<ConfigProfileDocument> {
    const doc = new ConfigProfileModel({
      ...params,
      isActive: params.isActive ?? false
    });
    await doc.save();
    return doc;
  }

  static async activateConfigProfile(guildId: string, name: string): Promise<void> {
    await ConfigProfileModel.updateMany({ guildId }, { $set: { isActive: false } }).exec();
    await ConfigProfileModel.findOneAndUpdate(
      { guildId, name },
      { $set: { isActive: true } }
    ).exec();
  }

  static async deleteConfigProfile(guildId: string, name: string): Promise<void> {
    await ConfigProfileModel.deleteOne({ guildId, name }).exec();
  }

  static async exportConfigProfile(guildId: string, name: string): Promise<Record<string, unknown> | null> {
    const doc = await ConfigProfileModel.findOne({ guildId, name }).exec();
    return doc?.snapshot ?? null;
  }

  static async importConfigProfile(params: {
    guildId: string;
    name: string;
    description?: string;
    snapshot: Record<string, unknown>;
  }): Promise<ConfigProfileDocument> {
    return this.createConfigProfile({ ...params, isActive: false });
  }

  // Simple permission check helper for commands
  static async memberHasAction(
    guildId: string,
    memberRoleIds: string[],
    moduleKey: string,
    action: string
  ): Promise<boolean> {
    const profiles = await PermissionProfileModel.find({
      guildId,
      roleIds: { $in: memberRoleIds }
    }).exec();

    return profiles.some((p) => {
      const allowed = (p.actions?.[moduleKey] as string[] | undefined) ?? [];
      return allowed.includes(action);
    });
  }

  // Preload default module definitions (seed)
  static async seedDefaults(): Promise<void> {
    const baseModules = [
      { moduleKey: 'core', label: 'Core Module Manager', version: '1.0.0' },
      { moduleKey: 'permissions', label: 'Permission Profiles', version: '1.0.0' },
      { moduleKey: 'config_profiles', label: 'Config Profiles', version: '1.0.0' },
      { moduleKey: 'moderation', label: 'Moderation Suite', version: '1.0.0' },
      { moduleKey: 'onboarding', label: 'Onboarding Suite', version: '1.0.0' },
      { moduleKey: 'engagement', label: 'Engagement Suite', version: '1.0.0' },
      { moduleKey: 'tickets', label: 'Tickets Advanced', version: '1.0.0' },
      { moduleKey: 'logging', label: 'Logging & Analytics', version: '1.0.0' },
      { moduleKey: 'music', label: 'Music & Radio', version: '1.0.0' }
    ];

    for (const mod of baseModules) {
      await ModuleDefinitionModel.findOneAndUpdate(
        { moduleKey: mod.moduleKey },
        mod,
        { upsert: true }
      ).exec();
    }
  }

  // Optional hook to run after client ready to seed base modules/config
  static async onReady(client: Client): Promise<void> {
    await this.seedDefaults();
    const guilds = await client.guilds.fetch();
    for (const [guildId] of guilds) {
      // Ensure core modules are tracked
      const coreKeys = ['core', 'permissions', 'config_profiles'];
      for (const key of coreKeys) {
        await GuildModuleModel.findOneAndUpdate(
          { guildId, moduleKey: key },
          { guildId, moduleKey: key, enabled: true },
          { upsert: true }
        ).exec();
      }
    }
  }
}
