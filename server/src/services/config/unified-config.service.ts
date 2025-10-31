/**
 * Unified Configuration Service
 *
 * Single source of truth for all application configuration.
 * Handles loading, saving, validation, and hot-reload of configuration.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import chokidar, { type FSWatcher } from 'chokidar';
import type { AppConfig, ConfigSection } from './config.schema.js';
import { validateConfig, validateSection } from './config.validator.js';
import { DEFAULT_CONFIG } from './config.defaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class UnifiedConfigService extends EventEmitter {
  private static instance: UnifiedConfigService | null = null;
  private config: AppConfig | null = null;
  private configPath: string;
  private defaultConfigPath: string;
  private watcher: FSWatcher | null = null;
  private writeLock: boolean = false;
  private lastLoaded: Date | null = null;

  private constructor() {
    super();
    // Config files are at project root
    this.configPath = path.resolve(__dirname, '../../../../config.json');
    this.defaultConfigPath = path.resolve(__dirname, '../../../../config.default.json');
  }

  public static getInstance(): UnifiedConfigService {
    if (!UnifiedConfigService.instance) {
      UnifiedConfigService.instance = new UnifiedConfigService();
    }
    return UnifiedConfigService.instance;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deep merge objects with proper handling of arrays and nested objects
   */
  private deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) return target;
    const source = sources.shift();

    if (!source) return this.deepMerge(target, ...sources);

    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (sourceValue === undefined || sourceValue === null) {
        continue;
      }

      if (this.isPlainObject(sourceValue) && this.isPlainObject(targetValue)) {
        target[key] = this.deepMerge({ ...targetValue }, sourceValue);
      } else {
        target[key] = sourceValue as any;
      }
    }

    return this.deepMerge(target, ...sources);
  }

  private isPlainObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Calculate difference between two configs
   */
  private diff(oldConfig: AppConfig | null, newConfig: AppConfig): Record<string, any> {
    if (!oldConfig) return { all: newConfig };

    const changes: Record<string, any> = {};
    const sections: ConfigSection[] = ['server', 'mikrotik', 'llm', 'assistant', 'ui'];

    for (const section of sections) {
      if (JSON.stringify(oldConfig[section]) !== JSON.stringify(newConfig[section])) {
        changes[section] = newConfig[section];
      }
    }

    return changes;
  }

  /**
   * Load defaults from config.default.json or use built-in defaults
   */
  private async loadDefaults(): Promise<AppConfig> {
    try {
      if (await this.fileExists(this.defaultConfigPath)) {
        const content = await fs.readFile(this.defaultConfigPath, 'utf-8');
        const parsed = JSON.parse(content);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.warn('[UnifiedConfig] Failed to load config.default.json, using built-in defaults');
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from config.json
   */
  private async loadConfigFile(): Promise<Partial<AppConfig>> {
    try {
      if (!(await this.fileExists(this.configPath))) {
        return {};
      }

      const content = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed;
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        console.error('[UnifiedConfig] Config file contains invalid JSON');
        throw new Error('Configuration file is corrupted or contains invalid JSON');
      }
      throw error;
    }
  }

  /**
   * Get environment variable overrides
   */
  private getEnvOverrides(): Partial<AppConfig> {
    const overrides: any = {};

    // Server overrides
    if (process.env.PORT) {
      overrides.server = overrides.server || {};
      overrides.server.port = parseInt(process.env.PORT, 10);
    }
    if (process.env.CORS_ORIGIN) {
      overrides.server = overrides.server || {};
      overrides.server.corsOrigin = process.env.CORS_ORIGIN;
    }
    if (process.env.NODE_ENV) {
      overrides.server = overrides.server || {};
      overrides.server.nodeEnv = process.env.NODE_ENV;
    }

    // MikroTik overrides
    if (process.env.MIKROTIK_HOST) {
      overrides.mikrotik = overrides.mikrotik || {};
      overrides.mikrotik.host = process.env.MIKROTIK_HOST;
    }
    if (process.env.MIKROTIK_PORT) {
      overrides.mikrotik = overrides.mikrotik || {};
      overrides.mikrotik.port = parseInt(process.env.MIKROTIK_PORT, 10);
    }
    if (process.env.MIKROTIK_USERNAME) {
      overrides.mikrotik = overrides.mikrotik || {};
      overrides.mikrotik.username = process.env.MIKROTIK_USERNAME;
    }
    if (process.env.MIKROTIK_PASSWORD) {
      overrides.mikrotik = overrides.mikrotik || {};
      overrides.mikrotik.password = process.env.MIKROTIK_PASSWORD;
    }
    if (process.env.MIKROTIK_TIMEOUT) {
      overrides.mikrotik = overrides.mikrotik || {};
      overrides.mikrotik.timeout = parseInt(process.env.MIKROTIK_TIMEOUT, 10);
    }

    // LLM overrides
    if (process.env.LLM_PROVIDER) {
      overrides.llm = overrides.llm || {};
      overrides.llm.provider = process.env.LLM_PROVIDER;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      overrides.llm = overrides.llm || {};
      overrides.llm.claude = overrides.llm.claude || {};
      overrides.llm.claude.apiKey = process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.CLAUDE_MODEL) {
      overrides.llm = overrides.llm || {};
      overrides.llm.claude = overrides.llm.claude || {};
      overrides.llm.claude.model = process.env.CLAUDE_MODEL;
    }
    if (process.env.LMSTUDIO_ENDPOINT) {
      overrides.llm = overrides.llm || {};
      overrides.llm.lmstudio = overrides.llm.lmstudio || {};
      overrides.llm.lmstudio.endpoint = process.env.LMSTUDIO_ENDPOINT;
    }
    if (process.env.LMSTUDIO_MODEL) {
      overrides.llm = overrides.llm || {};
      overrides.llm.lmstudio = overrides.llm.lmstudio || {};
      overrides.llm.lmstudio.model = process.env.LMSTUDIO_MODEL;
    }
    if (process.env.LMSTUDIO_CONTEXT_WINDOW) {
      overrides.llm = overrides.llm || {};
      overrides.llm.lmstudio = overrides.llm.lmstudio || {};
      overrides.llm.lmstudio.contextWindow = parseInt(process.env.LMSTUDIO_CONTEXT_WINDOW, 10);
    }

    // Cloudflare overrides
    if (process.env.CLOUDFLARE_ACCOUNT_ID) {
      overrides.llm = overrides.llm || {};
      overrides.llm.cloudflare = overrides.llm.cloudflare || {};
      overrides.llm.cloudflare.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    }
    if (process.env.CLOUDFLARE_API_TOKEN) {
      overrides.llm = overrides.llm || {};
      overrides.llm.cloudflare = overrides.llm.cloudflare || {};
      overrides.llm.cloudflare.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    }
    if (process.env.CLOUDFLARE_AI_MODEL) {
      overrides.llm = overrides.llm || {};
      overrides.llm.cloudflare = overrides.llm.cloudflare || {};
      overrides.llm.cloudflare.model = process.env.CLOUDFLARE_AI_MODEL;
    }
    if (process.env.CLOUDFLARE_AI_GATEWAY) {
      overrides.llm = overrides.llm || {};
      overrides.llm.cloudflare = overrides.llm.cloudflare || {};
      overrides.llm.cloudflare.gateway = process.env.CLOUDFLARE_AI_GATEWAY;
    }

    // Assistant overrides
    if (process.env.AI_TEMPERATURE) {
      overrides.assistant = overrides.assistant || {};
      overrides.assistant.temperature = parseFloat(process.env.AI_TEMPERATURE);
    }
    if (process.env.AI_MAX_TOKENS) {
      overrides.assistant = overrides.assistant || {};
      overrides.assistant.maxTokens = parseInt(process.env.AI_MAX_TOKENS, 10);
    }
    if (process.env.AI_SYSTEM_PROMPT) {
      overrides.assistant = overrides.assistant || {};
      overrides.assistant.systemPrompt = process.env.AI_SYSTEM_PROMPT;
    }

    return overrides;
  }

  /**
   * Load configuration with priority: defaults → config.json → env
   */
  public async load(): Promise<AppConfig> {
    try {
      const defaults = await this.loadDefaults();
      const fileConfig = await this.loadConfigFile();
      const envOverrides = this.getEnvOverrides();

      // Merge with priority
      this.config = this.deepMerge(
        { ...defaults },
        fileConfig,
        envOverrides
      );

      // Validate merged configuration
      const validation = validateConfig(this.config);
      if (!validation.valid) {
        console.error('[UnifiedConfig] Configuration validation failed:');
        validation.errors.forEach((err) => console.error(`  - ${err}`));
        throw new Error('Invalid configuration');
      }

      this.lastLoaded = new Date();
      console.log('[UnifiedConfig] Configuration loaded successfully');

      return this.config;
    } catch (error: any) {
      console.error('[UnifiedConfig] Failed to load configuration:', error.message);
      throw error;
    }
  }

  /**
   * Get current configuration (loads if not already loaded)
   */
  public async get(): Promise<AppConfig> {
    if (!this.config) {
      await this.load();
    }
    return this.config!;
  }

  /**
   * Get a specific configuration section
   */
  public async getSection(section: ConfigSection): Promise<any> {
    const config = await this.get();
    return config[section];
  }

  /**
   * Create backup of current config.json
   */
  private async backup(): Promise<void> {
    try {
      if (await this.fileExists(this.configPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = this.configPath.replace('.json', `.backup.${timestamp}.json`);
        await fs.copyFile(this.configPath, backupPath);
        console.log(`[UnifiedConfig] Backup created: ${backupPath}`);
      }
    } catch (error) {
      console.error('[UnifiedConfig] Failed to create backup:', error);
    }
  }

  /**
   * Atomic write to config.json
   */
  private async atomicWrite(config: AppConfig): Promise<void> {
    const tempPath = `${this.configPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(config, null, 2), 'utf-8');
    await fs.rename(tempPath, this.configPath);

    // Set secure permissions
    try {
      await fs.chmod(this.configPath, 0o600);
    } catch (error) {
      console.warn('[UnifiedConfig] Could not set file permissions to 600');
    }
  }

  /**
   * Save configuration to config.json
   */
  public async save(updates: Partial<AppConfig>): Promise<void> {
    // Wait for write lock
    while (this.writeLock) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.writeLock = true;

    try {
      // Load current file config
      const currentFileConfig = await this.loadConfigFile();
      const current = this.deepMerge({ ...DEFAULT_CONFIG }, currentFileConfig);

      // Merge updates
      const updated = this.deepMerge({ ...current }, updates);

      // Validate before saving
      const validation = validateConfig(updated);
      if (!validation.valid) {
        throw new Error(
          `Configuration validation failed:\n${validation.errors.join('\n')}`
        );
      }

      // Create backup
      await this.backup();

      // Atomic write
      await this.atomicWrite(updated);

      console.log('[UnifiedConfig] Configuration saved successfully');

      // Reload to pick up changes
      await this.reload();
    } finally {
      this.writeLock = false;
    }
  }

  /**
   * Save a specific section
   */
  public async saveSection(section: ConfigSection, data: any): Promise<void> {
    // Validate section data
    const validation = validateSection(section, data);
    if (!validation.valid) {
      throw new Error(
        `Section validation failed:\n${validation.errors.join('\n')}`
      );
    }

    await this.save({ [section]: data } as Partial<AppConfig>);
  }

  /**
   * Hot-reload configuration
   */
  public async reload(): Promise<void> {
    try {
      const oldConfig = this.config;
      const newConfig = await this.load();

      // Calculate what changed
      const changes = this.diff(oldConfig, newConfig);

      this.config = newConfig;

      // Emit section-specific events
      for (const section of Object.keys(changes)) {
        if (section !== 'all') {
          this.emit(`config:${section}:changed`, changes[section]);
          console.log(`[UnifiedConfig] Section '${section}' changed`);
        }
      }

      // Emit general reload event
      this.emit('config:reloaded', newConfig);
    } catch (error: any) {
      console.error('[UnifiedConfig] Hot-reload failed, keeping old config:', error.message);
      this.emit('config:reload:failed', error);
    }
  }

  /**
   * Watch configuration file for changes and hot-reload
   */
  public watch(): void {
    if (this.watcher) {
      console.warn('[UnifiedConfig] Watcher already active');
      return;
    }

    this.watcher = chokidar.watch(this.configPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.watcher.on('change', async () => {
      console.log('[UnifiedConfig] Configuration file changed, reloading...');
      await this.reload();
    });

    console.log('[UnifiedConfig] File watcher started');
  }

  /**
   * Stop watching configuration file
   */
  public async stopWatch(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log('[UnifiedConfig] File watcher stopped');
    }
  }

  /**
   * Register callback for section changes
   */
  public onSectionChange(section: ConfigSection, callback: (changes: any) => void): void {
    this.on(`config:${section}:changed`, callback);
  }

  /**
   * Register callback for any config change
   */
  public onChange(callback: (config: AppConfig) => void): void {
    this.on('config:reloaded', callback);
  }

  /**
   * Get last loaded timestamp
   */
  public getLastLoaded(): Date | null {
    return this.lastLoaded;
  }

  /**
   * Clear cached configuration
   */
  public clearCache(): void {
    this.config = null;
    console.log('[UnifiedConfig] Cache cleared');
  }

  /**
   * Validate current configuration
   */
  public async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const config = await this.get();
    return validateConfig(config);
  }
}

// Export singleton instance
export const unifiedConfigService = UnifiedConfigService.getInstance();
export default unifiedConfigService;
