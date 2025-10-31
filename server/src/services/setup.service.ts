/**
 * Setup Service
 * Handles initial setup wizard logic, connection testing, and configuration initialization
 */

import { unifiedConfigService } from './config/unified-config.service.js';
import type { AppConfig } from './config/config.schema.js';
import { RouterOSAPI } from 'node-routeros';

export interface SetupStatus {
  needsSetup: boolean;
  reasons: string[];
  currentConfig?: {
    mikrotikHost: string;
    llmProvider: string;
  };
}

export interface MikroTikTestConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
}

export interface MikroTikTestResult {
  success: boolean;
  error?: string;
  routerInfo?: {
    name: string;
    model: string;
    version: string;
    architecture: string;
  };
}

export interface LLMTestConfig {
  provider: 'claude' | 'lmstudio';
  claude?: {
    apiKey: string;
    model: string;
  };
  lmstudio?: {
    endpoint: string;
    model: string;
  };
}

export interface LLMTestResult {
  success: boolean;
  error?: string;
  providerInfo?: {
    provider: string;
    model: string;
  };
}

export interface SetupInitConfig {
  mikrotik: {
    host: string;
    port: number;
    username: string;
    password: string;
    timeout?: number;
    keepaliveInterval?: number;
  };
  llm?: {
    provider: 'claude' | 'lmstudio';
    claude?: {
      apiKey: string;
      model: string;
    };
    lmstudio?: {
      endpoint: string;
      model: string;
      contextWindow?: number;
    };
  };
}

export interface SetupInitResult {
  success: boolean;
  errors?: string[];
}

class SetupService {
  /**
   * Check if initial setup is needed
   */
  async checkSetupStatus(): Promise<SetupStatus> {
    try {
      const config = await unifiedConfigService.get();
      const reasons: string[] = [];

      // Check for default/placeholder values that indicate unconfigured system
      if (config.mikrotik.password === 'your_password_here' ||
          config.mikrotik.password === '' ||
          config.mikrotik.password === 'password') {
        reasons.push('MikroTik password not configured');
      }

      // Check if using default IP (might be intentional, but worth checking connection)
      if (config.mikrotik.host === '192.168.88.1') {
        // Try to connect to verify it's actually configured
        try {
          const testResult = await this.testMikroTikConnection({
            host: config.mikrotik.host,
            port: config.mikrotik.port,
            username: config.mikrotik.username,
            password: config.mikrotik.password,
            timeout: 5000,
          });

          if (!testResult.success) {
            reasons.push('Cannot connect to MikroTik router - verify credentials and network');
          }
        } catch (error) {
          reasons.push('MikroTik connection test failed');
        }
      }

      // Check LLM configuration (optional but should be set up)
      if (config.llm.provider === 'claude' && !config.llm.claude.apiKey) {
        // Claude selected but no API key - this is a problem
        reasons.push('Claude selected as LLM provider but API key not configured');
      }

      if (config.llm.provider === 'lmstudio' && !config.llm.lmstudio.endpoint) {
        // LMStudio selected but no endpoint - this is a problem
        reasons.push('LMStudio selected as LLM provider but endpoint not configured');
      }

      return {
        needsSetup: reasons.length > 0,
        reasons,
        currentConfig: {
          mikrotikHost: config.mikrotik.host,
          llmProvider: config.llm.provider,
        },
      };
    } catch (error: any) {
      console.error('[SetupService] Error checking setup status:', error);
      return {
        needsSetup: true,
        reasons: ['Configuration file error - setup required'],
      };
    }
  }

  /**
   * Test MikroTik connection with provided credentials
   */
  async testMikroTikConnection(config: MikroTikTestConfig): Promise<MikroTikTestResult> {
    let connection: RouterOSAPI | null = null;

    try {
      // Validate inputs
      if (!config.host || !config.username || !config.password) {
        return {
          success: false,
          error: 'Missing required fields: host, username, and password are required',
        };
      }

      // Validate port
      if (config.port < 1 || config.port > 65535) {
        return {
          success: false,
          error: 'Invalid port number. Must be between 1 and 65535',
        };
      }

      console.log(`[SetupService] Testing MikroTik connection to ${config.host}:${config.port}...`);

      connection = new RouterOSAPI({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        timeout: config.timeout || 10000,
      });

      await connection.connect();

      // Get router identity to verify connection and API access
      const identity = await connection.write('/system/identity/print');
      const resources = await connection.write('/system/resource/print');

      const routerInfo = {
        name: identity[0]?.name || 'Unknown',
        model: resources[0]?.['board-name'] || 'Unknown',
        version: resources[0]?.version || 'Unknown',
        architecture: resources[0]?.['architecture-name'] || 'Unknown',
      };

      console.log(`[SetupService] Connection successful! Router: ${routerInfo.name} (${routerInfo.model})`);

      await connection.close();

      return {
        success: true,
        routerInfo,
      };
    } catch (error: any) {
      console.error('[SetupService] MikroTik connection test failed:', error.message);

      let errorMessage = 'Failed to connect to MikroTik router';

      if (error.errno === 'CANTLOGIN') {
        errorMessage = 'Invalid username or password';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot reach router. Check IP address, port, and network connectivity';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Router hostname not found. Check IP address or hostname';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      // Ensure connection is closed
      if (connection) {
        try {
          await connection.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * Test LLM provider connection (optional)
   */
  async testLLMProvider(config: LLMTestConfig): Promise<LLMTestResult> {
    try {
      if (config.provider === 'claude') {
        if (!config.claude?.apiKey) {
          return {
            success: false,
            error: 'Claude API key is required',
          };
        }

        // Test Claude connection with a simple request
        const { Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({
          apiKey: config.claude.apiKey,
        });

        // Simple test message
        await anthropic.messages.create({
          model: config.claude.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }],
        });

        return {
          success: true,
          providerInfo: {
            provider: 'Claude',
            model: config.claude.model || 'claude-3-5-sonnet-20241022',
          },
        };
      } else if (config.provider === 'lmstudio') {
        if (!config.lmstudio?.endpoint) {
          return {
            success: false,
            error: 'LMStudio endpoint is required',
          };
        }

        // Test LMStudio endpoint with a simple fetch
        const response = await fetch(`${config.lmstudio.endpoint}/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          return {
            success: false,
            error: `LMStudio endpoint returned ${response.status}: ${response.statusText}`,
          };
        }

        return {
          success: true,
          providerInfo: {
            provider: 'LMStudio',
            model: config.lmstudio.model || 'default',
          },
        };
      }

      return {
        success: false,
        error: 'Unknown LLM provider',
      };
    } catch (error: any) {
      console.error('[SetupService] LLM provider test failed:', error);

      let errorMessage = 'Failed to connect to LLM provider';

      if (error.status === 401) {
        errorMessage = 'Invalid API key';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot reach LLM endpoint. Check endpoint URL and ensure service is running';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Initialize setup with validated configuration
   */
  async initializeSetup(setupConfig: SetupInitConfig): Promise<SetupInitResult> {
    const errors: string[] = [];

    try {
      // Validate MikroTik configuration
      if (!setupConfig.mikrotik.host) {
        errors.push('MikroTik host is required');
      }
      if (!setupConfig.mikrotik.username) {
        errors.push('MikroTik username is required');
      }
      if (!setupConfig.mikrotik.password) {
        errors.push('MikroTik password is required');
      }
      if (setupConfig.mikrotik.port < 1 || setupConfig.mikrotik.port > 65535) {
        errors.push('MikroTik port must be between 1 and 65535');
      }

      // Test MikroTik connection before saving
      const mikrotikTest = await this.testMikroTikConnection({
        host: setupConfig.mikrotik.host,
        port: setupConfig.mikrotik.port,
        username: setupConfig.mikrotik.username,
        password: setupConfig.mikrotik.password,
        timeout: setupConfig.mikrotik.timeout || 10000,
      });

      if (!mikrotikTest.success) {
        errors.push(`MikroTik connection failed: ${mikrotikTest.error}`);
        return { success: false, errors };
      }

      // Build config update object
      const configUpdate: Partial<AppConfig> = {
        mikrotik: {
          host: setupConfig.mikrotik.host,
          port: setupConfig.mikrotik.port,
          username: setupConfig.mikrotik.username,
          password: setupConfig.mikrotik.password,
          timeout: setupConfig.mikrotik.timeout || 10000,
          keepaliveInterval: setupConfig.mikrotik.keepaliveInterval || 30000,
        },
      };

      // Add LLM config if provided
      if (setupConfig.llm) {
        configUpdate.llm = {
          provider: setupConfig.llm.provider,
          claude: setupConfig.llm.claude || { apiKey: '', model: 'claude-3-5-sonnet-20241022' },
          lmstudio: {
            endpoint: setupConfig.llm.lmstudio?.endpoint || '',
            model: setupConfig.llm.lmstudio?.model || '',
            contextWindow: setupConfig.llm.lmstudio?.contextWindow ?? 32768,
          },
        };
      }

      // Save configuration
      await unifiedConfigService.save(configUpdate);

      console.log('[SetupService] Setup completed successfully');
      console.log('[SetupService] MikroTik:', setupConfig.mikrotik.host);
      console.log('[SetupService] LLM Provider:', setupConfig.llm?.provider || 'not configured');

      return { success: true };
    } catch (error: any) {
      console.error('[SetupService] Setup initialization failed:', error);
      errors.push(`Configuration save failed: ${error.message}`);
      return { success: false, errors };
    }
  }
}

export const setupService = new SetupService();
