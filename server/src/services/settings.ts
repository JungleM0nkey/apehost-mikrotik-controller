import { unifiedConfigService } from './config/unified-config.service.js';
import type { AppConfig } from './config/config.schema.js';

export interface ServerSettings {
  // Server Configuration
  server: {
    port: number;
    corsOrigin: string;
    nodeEnv: string;
  };

  // MikroTik Configuration
  mikrotik: {
    host: string;
    port: number;
    username: string;
    password: string;
    timeout: number;
    keepaliveInterval: number;
  };

  // LLM Configuration
  llm: {
    provider: 'claude' | 'lmstudio' | 'cloudflare';
    claude: {
      apiKey: string;
      model: string;
    };
    lmstudio: {
      endpoint: string;
      model: string;
      contextWindow: number;
    };
    cloudflare: {
      accountId: string;
      apiToken: string;
      model: string;
      gateway?: string;
    };
  };

  // AI Assistant Configuration
  assistant: {
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
  };
}

class SettingsService {
  constructor() {
    // Initialize unified config service
  }

  /**
   * Get current settings from UnifiedConfigService
   */
  async getSettings(): Promise<ServerSettings> {
    const config = await unifiedConfigService.get();

    return {
      server: {
        port: config.server.port,
        corsOrigin: config.server.corsOrigin,
        nodeEnv: config.server.nodeEnv,
      },
      mikrotik: {
        host: config.mikrotik.host,
        port: config.mikrotik.port,
        username: config.mikrotik.username,
        password: config.mikrotik.password,
        timeout: config.mikrotik.timeout,
        keepaliveInterval: config.mikrotik.keepaliveInterval,
      },
      llm: {
        provider: config.llm.provider,
        claude: {
          apiKey: config.llm.claude?.apiKey || '',
          model: config.llm.claude?.model || 'claude-3-5-sonnet-20241022',
        },
        lmstudio: {
          endpoint: config.llm.lmstudio?.endpoint || 'http://localhost:1234',
          model: config.llm.lmstudio?.model || '',
          contextWindow: config.llm.lmstudio?.contextWindow || 32768,
        },
        cloudflare: {
          accountId: config.llm.cloudflare?.accountId || '',
          apiToken: config.llm.cloudflare?.apiToken || '',
          model: config.llm.cloudflare?.model || '@cf/meta/llama-4-scout-17b-16e-instruct',
          gateway: config.llm.cloudflare?.gateway,
        },
      },
      assistant: {
        temperature: config.assistant.temperature,
        maxTokens: config.assistant.maxTokens,
        systemPrompt: config.assistant.systemPrompt,
      },
    };
  }

  /**
   * Update settings by saving to UnifiedConfigService
   */
  async updateSettings(settings: Partial<ServerSettings>): Promise<void> {
    try {
      // Get current config
      const config = await unifiedConfigService.get();

      // Create updated config by merging changes
      const updatedConfig: AppConfig = {
        ...config,
        server: settings.server ? {
          ...config.server,
          ...settings.server,
          nodeEnv: (settings.server.nodeEnv as 'development' | 'production' | 'test') ?? config.server.nodeEnv,
        } : config.server,
        mikrotik: settings.mikrotik ? {
          ...config.mikrotik,
          host: settings.mikrotik.host ?? config.mikrotik.host,
          port: settings.mikrotik.port ?? config.mikrotik.port,
          username: settings.mikrotik.username ?? config.mikrotik.username,
          password: settings.mikrotik.password ?? config.mikrotik.password,
          timeout: settings.mikrotik.timeout ?? config.mikrotik.timeout,
          keepaliveInterval: settings.mikrotik.keepaliveInterval ?? config.mikrotik.keepaliveInterval,
        } : config.mikrotik,
        llm: settings.llm ? {
          ...config.llm,
          provider: settings.llm.provider || config.llm.provider,
          claude: {
            ...config.llm.claude,
            ...(settings.llm.claude ? {
              apiKey: settings.llm.claude.apiKey || config.llm.claude?.apiKey || '',
              model: settings.llm.claude.model || config.llm.claude?.model || 'claude-3-5-sonnet-20241022',
            } : {}),
          },
          lmstudio: {
            ...config.llm.lmstudio,
            ...(settings.llm.lmstudio ? {
              endpoint: settings.llm.lmstudio.endpoint || config.llm.lmstudio?.endpoint || '',
              model: settings.llm.lmstudio.model || config.llm.lmstudio?.model || '',
              contextWindow: settings.llm.lmstudio.contextWindow || config.llm.lmstudio?.contextWindow || 32768,
            } : {}),
          },
          cloudflare: settings.llm.cloudflare ? {
            accountId: settings.llm.cloudflare.accountId || config.llm.cloudflare?.accountId || '',
            apiToken: settings.llm.cloudflare.apiToken || config.llm.cloudflare?.apiToken || '',
            model: settings.llm.cloudflare.model || config.llm.cloudflare?.model || '@cf/meta/llama-4-scout-17b-16e-instruct',
            gateway: settings.llm.cloudflare.gateway || config.llm.cloudflare?.gateway,
          } : config.llm.cloudflare,
        } : config.llm,
        assistant: settings.assistant ? {
          ...config.assistant,
          ...settings.assistant,
        } : config.assistant,
        ui: config.ui, // Keep UI settings unchanged
      };

      // Save updated configuration
      await unifiedConfigService.save(updatedConfig);
      console.log('[SettingsService] Settings updated successfully');
    } catch (error: any) {
      console.error('[SettingsService] Failed to update settings:', error.message);
      throw error;
    }
  }

  /**
   * Refresh settings from disk (reload config)
   */
  async refreshSettings(): Promise<void> {
    await unifiedConfigService.reload();
    console.log('[SettingsService] Settings refreshed from disk');
  }

  /**
   * Watch for configuration changes
   */
  watchSettings(callback: () => void): void {
    unifiedConfigService.watch();
    unifiedConfigService.on('change', callback);
    console.log('[SettingsService] Watching for settings changes');
  }

  /**
   * Stop watching for configuration changes
   */
  async unwatchSettings(callback?: () => void): Promise<void> {
    if (callback) {
      unifiedConfigService.off('change', callback);
    }
    await unifiedConfigService.stopWatch();
    console.log('[SettingsService] Stopped watching for settings changes');
  }
}

const settingsService = new SettingsService();
export default settingsService;
