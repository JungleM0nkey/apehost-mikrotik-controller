/**
 * Configuration Migrator
 *
 * Handles migration from .env files to config.json format
 * Supports:
 * - Parsing multiple .env files with priority (server/.env > .env)
 * - Comment preservation and documentation
 * - Type conversion and validation
 * - Dry-run mode for testing
 * - Backup creation before migration
 */

import fs from 'fs/promises';
import path from 'path';
import { AppConfig } from './config.schema.js';
import { DEFAULT_CONFIG } from './config.defaults.js';
import { validateConfig } from './config.validator.js';

interface EnvVariable {
  key: string;
  value: string;
  comment?: string;
}

interface MigrationOptions {
  dryRun?: boolean;
  createBackup?: boolean;
  preserveComments?: boolean;
  rootEnvPath?: string;
  serverEnvPath?: string;
  outputPath?: string;
}

interface MigrationResult {
  success: boolean;
  config?: AppConfig;
  errors: string[];
  warnings: string[];
  backupPath?: string;
}

/**
 * Environment variable to config.json path mapping
 */
const ENV_MAPPING: Record<string, string> = {
  // Server configuration
  PORT: 'server.port',
  NODE_ENV: 'server.nodeEnv',
  CORS_ORIGIN: 'server.corsOrigin',

  // MikroTik configuration
  MIKROTIK_HOST: 'mikrotik.host',
  MIKROTIK_PORT: 'mikrotik.port',
  MIKROTIK_USERNAME: 'mikrotik.username',
  MIKROTIK_PASSWORD: 'mikrotik.password',
  MIKROTIK_TIMEOUT: 'mikrotik.timeout',

  // LLM configuration
  LLM_PROVIDER: 'llm.provider',
  ANTHROPIC_API_KEY: 'llm.anthropic.apiKey',
  CLAUDE_MODEL: 'llm.anthropic.model',
  LMSTUDIO_ENDPOINT: 'llm.lmstudio.endpoint',
  LMSTUDIO_MODEL: 'llm.lmstudio.model',
  LMSTUDIO_CONTEXT_WINDOW: 'llm.lmstudio.contextWindow',

  // Assistant configuration
  AI_TEMPERATURE: 'assistant.temperature',
  AI_MAX_TOKENS: 'assistant.maxTokens',
  AI_SYSTEM_PROMPT: 'assistant.systemPrompt',
};

export class ConfigMigrator {
  private rootEnvPath: string;
  private serverEnvPath: string;
  private outputPath: string;

  constructor(
    rootDir: string = process.cwd(),
    serverDir: string = path.join(process.cwd(), 'server')
  ) {
    this.rootEnvPath = path.join(rootDir, '.env');
    this.serverEnvPath = path.join(serverDir, '.env');
    this.outputPath = path.join(rootDir, 'config.json');
  }

  /**
   * Main migration method
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      errors: [],
      warnings: [],
    };

    try {
      // Step 1: Parse .env files
      const rootEnv = await this.parseEnvFile(
        options.rootEnvPath || this.rootEnvPath
      );
      const serverEnv = await this.parseEnvFile(
        options.serverEnvPath || this.serverEnvPath
      );

      // Step 2: Merge environment variables (server overrides root)
      const mergedEnv = this.mergeEnvVariables(rootEnv, serverEnv);

      // Step 3: Convert to config.json structure
      const config = this.convertToConfig(mergedEnv);

      // Step 4: Validate the configuration
      const validation = validateConfig(config);
      if (!validation.valid) {
        result.errors.push(...validation.errors);
        return result;
      }

      result.config = config;

      // Step 5: Dry run check
      if (options.dryRun) {
        result.success = true;
        result.warnings.push('Dry run mode - no files were modified');
        return result;
      }

      // Step 6: Create backup if requested
      if (options.createBackup !== false) {
        try {
          result.backupPath = await this.createBackup();
        } catch (error: any) {
          result.warnings.push(`Backup creation failed: ${error.message}`);
        }
      }

      // Step 7: Write config.json
      const outputPath = options.outputPath || this.outputPath;
      await fs.writeFile(
        outputPath,
        JSON.stringify(config, null, 2) + '\n',
        { encoding: 'utf8', mode: 0o600 }
      );

      result.success = true;
      return result;
    } catch (error: any) {
      result.errors.push(`Migration failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Parse an .env file into key-value pairs with comments
   */
  private async parseEnvFile(filePath: string): Promise<EnvVariable[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.parseEnvContent(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty array
        return [];
      }
      throw error;
    }
  }

  /**
   * Parse .env content into structured variables
   */
  private parseEnvContent(content: string): EnvVariable[] {
    const variables: EnvVariable[] = [];
    const lines = content.split('\n');
    let currentComment: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        currentComment = [];
        continue;
      }

      // Collect comments
      if (trimmed.startsWith('#')) {
        currentComment.push(trimmed.substring(1).trim());
        continue;
      }

      // Parse key=value
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) {
        const [, key, rawValue] = match;
        const value = this.parseEnvValue(rawValue);

        variables.push({
          key,
          value,
          comment: currentComment.length > 0 ? currentComment.join(' ') : undefined,
        });

        currentComment = [];
      }
    }

    return variables;
  }

  /**
   * Parse environment variable value, handling quotes and escapes
   */
  private parseEnvValue(raw: string): string {
    let value = raw.trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.substring(1, value.length - 1);
    }

    // Unescape special characters
    value = value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');

    return value;
  }

  /**
   * Merge environment variables with priority (server overrides root)
   */
  private mergeEnvVariables(
    rootEnv: EnvVariable[],
    serverEnv: EnvVariable[]
  ): Map<string, string> {
    const merged = new Map<string, string>();

    // Add root variables first
    for (const variable of rootEnv) {
      merged.set(variable.key, variable.value);
    }

    // Override with server variables
    for (const variable of serverEnv) {
      merged.set(variable.key, variable.value);
    }

    return merged;
  }

  /**
   * Convert environment variables to config.json structure
   */
  private convertToConfig(env: Map<string, string>): AppConfig {
    // Start with default configuration
    const config: any = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Map environment variables to config structure
    for (const [key, value] of env.entries()) {
      const configPath = ENV_MAPPING[key];
      if (!configPath) {
        // Unknown environment variable, skip
        continue;
      }

      // Set the value in the config object
      this.setNestedValue(config, configPath, this.convertValue(value));
    }

    return config as AppConfig;
  }

  /**
   * Set a nested value in an object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Convert string value to appropriate type
   */
  private convertValue(value: string): any {
    // Boolean conversion
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Number conversion
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // String (default)
    return value;
  }

  /**
   * Create backup of existing .env files
   */
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(this.outputPath), '.env-backups');

    // Create backup directory
    await fs.mkdir(backupDir, { recursive: true });

    // Backup root .env
    try {
      const rootContent = await fs.readFile(this.rootEnvPath, 'utf8');
      const rootBackupPath = path.join(backupDir, `.env.${timestamp}`);
      await fs.writeFile(rootBackupPath, rootContent, 'utf8');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Backup server .env
    try {
      const serverContent = await fs.readFile(this.serverEnvPath, 'utf8');
      const serverBackupPath = path.join(backupDir, `server.env.${timestamp}`);
      await fs.writeFile(serverBackupPath, serverContent, 'utf8');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    return backupDir;
  }

  /**
   * Generate a migration report
   */
  async generateReport(result: MigrationResult): Promise<string> {
    const lines: string[] = [];

    lines.push('=== Configuration Migration Report ===');
    lines.push('');
    lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push('');

    if (result.backupPath) {
      lines.push(`Backup created: ${result.backupPath}`);
      lines.push('');
    }

    if (result.config) {
      lines.push('Migrated Configuration:');
      lines.push(`- Server Port: ${result.config.server.port}`);
      lines.push(`- Server Environment: ${result.config.server.nodeEnv}`);
      lines.push(`- MikroTik Host: ${result.config.mikrotik.host}`);
      lines.push(`- MikroTik Port: ${result.config.mikrotik.port}`);
      lines.push(`- LLM Provider: ${result.config.llm.provider}`);

      if (result.config.llm.provider === 'claude') {
        lines.push(`- Claude Model: ${result.config.llm.anthropic.model}`);
      } else {
        lines.push(`- LM Studio Endpoint: ${result.config.llm.lmstudio.endpoint}`);
        lines.push(`- LM Studio Model: ${result.config.llm.lmstudio.model}`);
      }

      lines.push('');
    }

    if (result.errors.length > 0) {
      lines.push('Errors:');
      result.errors.forEach(err => lines.push(`  - ${err}`));
      lines.push('');
    }

    if (result.warnings.length > 0) {
      lines.push('Warnings:');
      result.warnings.forEach(warn => lines.push(`  - ${warn}`));
      lines.push('');
    }

    lines.push('Next Steps:');
    if (result.success) {
      lines.push('1. Review the generated config.json file');
      lines.push('2. Test the application with the new configuration');
      lines.push('3. Once verified, you can safely remove .env files');
      lines.push('4. Update .gitignore to exclude config.json');
    } else {
      lines.push('1. Review the errors above');
      lines.push('2. Fix issues in your .env files');
      lines.push('3. Run migration again');
    }

    return lines.join('\n');
  }
}
