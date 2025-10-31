/**
 * LLM Provider Factory
 * Creates appropriate provider based on configuration
 */

import type { LLMProvider } from './providers/base.js';
import { ClaudeProvider } from './providers/claude.js';
import { LMStudioProvider } from './providers/lmstudio.js';
import { CloudflareProvider } from './providers/cloudflare.js';
import { ConfigError } from './errors/index.js';
import { configManager } from '../config-manager.js';
import { unifiedConfigService } from '../config/unified-config.service.js';

export type ProviderType = 'claude' | 'lmstudio' | 'cloudflare';

export interface ProviderConfig {
  type: ProviderType;
  claudeApiKey?: string;
  claudeModel?: string;
  lmstudioEndpoint?: string;
  lmstudioModel?: string;
  lmstudioContextWindow?: number;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareModel?: string;
  cloudflareGateway?: string;
}

export class ProviderFactory {
  /**
   * Create LLM provider from configuration
   */
  static createProvider(config: ProviderConfig): LLMProvider {
    console.log(`[ProviderFactory] Creating provider: ${config.type}`);

    switch (config.type) {
      case 'claude':
        if (!config.claudeApiKey) {
          throw new ConfigError('Claude API key is required. Set ANTHROPIC_API_KEY in .env');
        }
        return new ClaudeProvider(config.claudeApiKey, config.claudeModel);

      case 'lmstudio':
        if (!config.lmstudioEndpoint || !config.lmstudioModel) {
          throw new ConfigError('LM Studio endpoint and model are required. Set LMSTUDIO_ENDPOINT and LMSTUDIO_MODEL in .env');
        }
        return new LMStudioProvider(config.lmstudioEndpoint, config.lmstudioModel, config.lmstudioContextWindow);

      case 'cloudflare':
        if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
          throw new ConfigError('Cloudflare Account ID and API Token are required. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env');
        }
        return new CloudflareProvider({
          accountId: config.cloudflareAccountId,
          apiToken: config.cloudflareApiToken,
          model: config.cloudflareModel,
          gateway: config.cloudflareGateway,
        });

      default:
        throw new ConfigError(`Unknown provider type: ${config.type}. Use 'claude', 'lmstudio', or 'cloudflare'`);
    }
  }

  /**
   * Create provider from configuration manager
   */
  static async createFromConfig(): Promise<LLMProvider | null> {
    try {
      const llmConfig = await configManager.getLLMConfig();

      const config: ProviderConfig = {
        type: llmConfig.provider,
        claudeApiKey: llmConfig.claude.apiKey,
        claudeModel: llmConfig.claude.model,
        lmstudioEndpoint: llmConfig.lmstudio.endpoint,
        lmstudioModel: llmConfig.lmstudio.model,
        lmstudioContextWindow: llmConfig.lmstudio.contextWindow,
        cloudflareAccountId: llmConfig.cloudflare?.accountId,
        cloudflareApiToken: llmConfig.cloudflare?.apiToken,
        cloudflareModel: llmConfig.cloudflare?.model,
        cloudflareGateway: llmConfig.cloudflare?.gateway,
      };

      console.log(`[ProviderFactory] Config values - endpoint: ${config.lmstudioEndpoint}, model: ${config.lmstudioModel}, contextWindow: ${config.lmstudioContextWindow}`);
      const provider = this.createProvider(config);
      console.log(`[ProviderFactory] Successfully created ${provider.getName()} provider`);
      return provider;
    } catch (error: any) {
      console.error('[ProviderFactory] Failed to create provider:', error.message);
      return null;
    }
  }

  /**
   * @deprecated Use createFromConfig() instead
   * Create provider from environment variables (fallback)
   */
  static createFromEnv(): LLMProvider | null {
    const providerType = (process.env.LLM_PROVIDER || 'claude').toLowerCase() as ProviderType;

    const config: ProviderConfig = {
      type: providerType,
      claudeApiKey: process.env.ANTHROPIC_API_KEY,
      claudeModel: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      lmstudioEndpoint: process.env.LMSTUDIO_ENDPOINT || 'http://localhost:1234/v1',
      lmstudioModel: process.env.LMSTUDIO_MODEL,
      lmstudioContextWindow: process.env.LMSTUDIO_CONTEXT_WINDOW ? parseInt(process.env.LMSTUDIO_CONTEXT_WINDOW, 10) : undefined,
      cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
      cloudflareModel: process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct',
      cloudflareGateway: process.env.CLOUDFLARE_AI_GATEWAY,
    };

    try {
      const provider = this.createProvider(config);
      console.log(`[ProviderFactory] Successfully created ${provider.getName()} provider`);
      return provider;
    } catch (error: any) {
      console.error('[ProviderFactory] Failed to create provider:', error.message);
      return null;
    }
  }

  /**
   * Validate provider configuration without creating instance
   */
  static validateConfig(config: ProviderConfig): { valid: boolean; error?: string } {
    try {
      // Just attempt to create - constructor validates config
      this.createProvider(config);
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }
}

// Create global provider instance
let globalProvider: LLMProvider | null = null;
let providerInitPromise: Promise<LLMProvider | null> | null = null;

export async function getGlobalProvider(): Promise<LLMProvider | null> {
  if (!globalProvider && !providerInitPromise) {
    providerInitPromise = ProviderFactory.createFromConfig();
    globalProvider = await providerInitPromise;
    providerInitPromise = null;
  }
  return globalProvider;
}

export function setGlobalProvider(provider: LLMProvider): void {
  globalProvider = provider;
}

/**
 * Refresh the global provider by clearing cache and recreating from config manager
 * Call this after updating settings to apply changes without server restart
 */
export async function refreshGlobalProvider(): Promise<LLMProvider | null> {
  console.log('[ProviderFactory] Refreshing global provider with updated settings');

  // Clear all caches in the chain (order matters!)
  globalProvider = null; // Clear cached provider instance
  providerInitPromise = null; // Clear any pending init promise
  configManager.clearCache(); // Clear ConfigManager cache
  unifiedConfigService.clearCache(); // Clear UnifiedConfigService cache

  // Reload config from disk and recreate provider
  await unifiedConfigService.reload(); // Reload from disk first
  await configManager.refreshConfig(); // Then refresh ConfigManager
  return await getGlobalProvider(); // Finally recreate provider with fresh config
}
