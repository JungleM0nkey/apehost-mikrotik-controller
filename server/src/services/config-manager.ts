/**
 * Central Configuration Manager
 *
 * Single source of truth for all application configuration.
 * Loads settings from SettingsService (web UI managed) with .env as fallback defaults.
 */

import settingsService from './settings.js';
import type { ServerSettings } from './settings.js';

export interface AppConfig {
  server: {
    port: number;
    corsOrigin: string;
    nodeEnv: string;
  };
  mikrotik: {
    host: string;
    port: number;
    username: string;
    password: string;
    timeout: number;
    keepaliveInterval: number;
  };
  llm: {
    provider: 'claude' | 'lmstudio';
    claude: {
      apiKey: string;
      model: string;
    };
    lmstudio: {
      endpoint: string;
      model: string;
      contextWindow: number;
    };
  };
  assistant: {
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
  };
}

class ConfigManager {
  private static instance: ConfigManager | null = null;
  private config: AppConfig | null = null;
  private lastLoaded: Date | null = null;

  private constructor() {
    // SettingsService is a singleton instance
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from SettingsService
   */
  public async loadConfig(): Promise<AppConfig> {
    try {
      const settings = await settingsService.getSettings();

      this.config = {
        server: {
          port: settings.server.port,
          corsOrigin: settings.server.corsOrigin,
          nodeEnv: settings.server.nodeEnv,
        },
        mikrotik: {
          host: settings.mikrotik.host,
          port: settings.mikrotik.port,
          username: settings.mikrotik.username,
          password: settings.mikrotik.password,
          timeout: settings.mikrotik.timeout,
          keepaliveInterval: settings.mikrotik.keepaliveInterval,
        },
        llm: {
          provider: settings.llm.provider,
          claude: {
            apiKey: settings.llm.claude.apiKey,
            model: settings.llm.claude.model,
          },
          lmstudio: {
            endpoint: settings.llm.lmstudio.endpoint,
            model: settings.llm.lmstudio.model,
            contextWindow: settings.llm.lmstudio.contextWindow,
          },
        },
        assistant: {
          temperature: settings.assistant.temperature,
          maxTokens: settings.assistant.maxTokens,
          systemPrompt: settings.assistant.systemPrompt,
        },
      };

      this.lastLoaded = new Date();
      console.log('[ConfigManager] Configuration loaded successfully');
      console.log(`[ConfigManager] MikroTik: ${this.config.mikrotik.host}:${this.config.mikrotik.port} (user: ${this.config.mikrotik.username})`);
      console.log(`[ConfigManager] LLM Provider: ${this.config.llm.provider}`);

      return this.config;
    } catch (error: any) {
      console.error('[ConfigManager] Failed to load config:', error.message);
      throw error;
    }
  }

  /**
   * Get current configuration (loads if not already loaded)
   */
  public async getConfig(): Promise<AppConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }

  /**
   * Refresh configuration from SettingsService
   * Call this after updating settings via web UI
   */
  public async refreshConfig(): Promise<AppConfig> {
    console.log('[ConfigManager] Refreshing configuration...');
    this.config = null;
    return await this.loadConfig();
  }

  /**
   * Get MikroTik configuration
   */
  public async getMikroTikConfig() {
    const config = await this.getConfig();
    return config.mikrotik;
  }

  /**
   * Get LLM configuration
   */
  public async getLLMConfig() {
    const config = await this.getConfig();
    return config.llm;
  }

  /**
   * Get server configuration
   */
  public async getServerConfig() {
    const config = await this.getConfig();
    return config.server;
  }

  /**
   * Get assistant configuration
   */
  public async getAssistantConfig() {
    const config = await this.getConfig();
    return config.assistant;
  }

  /**
   * Update settings via SettingsService and refresh config
   */
  public async updateSettings(settings: Partial<ServerSettings>): Promise<void> {
    await settingsService.updateSettings(settings);
    await this.refreshConfig();
    console.log('[ConfigManager] Settings updated and config refreshed');
  }

  /**
   * Get last loaded timestamp
   */
  public getLastLoaded(): Date | null {
    return this.lastLoaded;
  }

  /**
   * Clear cached configuration (force reload on next getConfig)
   */
  public clearCache(): void {
    this.config = null;
    console.log('[ConfigManager] Configuration cache cleared');
  }
}

export const configManager = ConfigManager.getInstance();
export default configManager;
