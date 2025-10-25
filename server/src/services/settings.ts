import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  };

  // LLM Configuration
  llm: {
    provider: 'claude' | 'lmstudio';
    claude: {
      apiKey: string;
      model: string;
    };
    lmstudio: {
      endpoint: string;
      model: string;
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
  private envPath: string;

  constructor() {
    // Find .env file in project root
    this.envPath = path.resolve(__dirname, '../../../.env');
  }

  /**
   * Get current settings from environment variables
   */
  async getSettings(): Promise<ServerSettings> {
    return {
      server: {
        port: parseInt(process.env.PORT || '3000', 10),
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        nodeEnv: process.env.NODE_ENV || 'development',
      },
      mikrotik: {
        host: process.env.MIKROTIK_HOST || '192.168.88.1',
        port: parseInt(process.env.MIKROTIK_PORT || '8728', 10),
        username: process.env.MIKROTIK_USERNAME || 'admin',
        password: process.env.MIKROTIK_PASSWORD || '',
      },
      llm: {
        provider: (process.env.LLM_PROVIDER as 'claude' | 'lmstudio') || 'lmstudio',
        claude: {
          apiKey: process.env.ANTHROPIC_API_KEY || '',
          model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        },
        lmstudio: {
          endpoint: process.env.LMSTUDIO_ENDPOINT || 'http://localhost:1234',
          model: process.env.LMSTUDIO_MODEL || '',
        },
      },
      assistant: {
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
        systemPrompt: process.env.AI_SYSTEM_PROMPT ||
          'You are an expert MikroTik router assistant. Help users configure and troubleshoot their MikroTik RouterOS devices. Be concise, accurate, and security-conscious.',
      },
    };
  }

  /**
   * Update settings by writing to .env file
   */
  async updateSettings(settings: Partial<ServerSettings>): Promise<void> {
    try {
      // Read current .env file
      let envContent = '';
      try {
        envContent = await fs.readFile(this.envPath, 'utf-8');
      } catch (error) {
        // If .env doesn't exist, try .env.example
        const examplePath = path.resolve(__dirname, '../../../.env.example');
        envContent = await fs.readFile(examplePath, 'utf-8');
      }

      // Update environment variables
      const updates: Record<string, string> = {};

      if (settings.server) {
        if (settings.server.port !== undefined) updates.PORT = settings.server.port.toString();
        if (settings.server.corsOrigin) updates.CORS_ORIGIN = settings.server.corsOrigin;
        if (settings.server.nodeEnv) updates.NODE_ENV = settings.server.nodeEnv;
      }

      if (settings.mikrotik) {
        if (settings.mikrotik.host) updates.MIKROTIK_HOST = settings.mikrotik.host;
        if (settings.mikrotik.port !== undefined) updates.MIKROTIK_PORT = settings.mikrotik.port.toString();
        if (settings.mikrotik.username) updates.MIKROTIK_USERNAME = settings.mikrotik.username;
        if (settings.mikrotik.password) updates.MIKROTIK_PASSWORD = settings.mikrotik.password;
      }

      if (settings.llm) {
        if (settings.llm.provider) updates.LLM_PROVIDER = settings.llm.provider;
        if (settings.llm.claude?.apiKey) updates.ANTHROPIC_API_KEY = settings.llm.claude.apiKey;
        if (settings.llm.claude?.model) updates.CLAUDE_MODEL = settings.llm.claude.model;
        if (settings.llm.lmstudio?.endpoint) updates.LMSTUDIO_ENDPOINT = settings.llm.lmstudio.endpoint;
        if (settings.llm.lmstudio?.model) updates.LMSTUDIO_MODEL = settings.llm.lmstudio.model;
      }

      if (settings.assistant) {
        if (settings.assistant.temperature !== undefined) updates.AI_TEMPERATURE = settings.assistant.temperature.toString();
        if (settings.assistant.maxTokens !== undefined) updates.AI_MAX_TOKENS = settings.assistant.maxTokens.toString();
        if (settings.assistant.systemPrompt) updates.AI_SYSTEM_PROMPT = settings.assistant.systemPrompt;
      }

      // Update .env content
      let updatedContent = envContent;
      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'gm');
        if (regex.test(updatedContent)) {
          // Update existing variable
          updatedContent = updatedContent.replace(regex, `${key}=${value}`);
        } else {
          // Add new variable
          updatedContent += `\n${key}=${value}`;
        }
      }

      // Write updated content to .env
      await fs.writeFile(this.envPath, updatedContent, 'utf-8');

      // Update process.env
      for (const [key, value] of Object.entries(updates)) {
        process.env[key] = value;
      }

      console.log('[Settings] Settings updated successfully');
    } catch (error) {
      console.error('[Settings] Failed to update settings:', error);
      throw new Error('Failed to update settings');
    }
  }

  /**
   * Validate settings
   */
  validateSettings(settings: Partial<ServerSettings>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.server?.port !== undefined) {
      if (settings.server.port < 1 || settings.server.port > 65535) {
        errors.push('Server port must be between 1 and 65535');
      }
    }

    if (settings.mikrotik?.port !== undefined) {
      if (settings.mikrotik.port < 1 || settings.mikrotik.port > 65535) {
        errors.push('MikroTik port must be between 1 and 65535');
      }
    }

    if (settings.mikrotik?.host) {
      // Basic IP/hostname validation
      const hostPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
      if (!hostPattern.test(settings.mikrotik.host) && settings.mikrotik.host !== 'localhost') {
        errors.push('Invalid MikroTik host address or hostname');
      }
    }

    if (settings.llm?.provider && !['claude', 'lmstudio'].includes(settings.llm.provider)) {
      errors.push('LLM provider must be either "claude" or "lmstudio"');
    }

    if (settings.assistant?.temperature !== undefined) {
      if (settings.assistant.temperature < 0 || settings.assistant.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    if (settings.assistant?.maxTokens !== undefined) {
      if (settings.assistant.maxTokens < 100 || settings.assistant.maxTokens > 100000) {
        errors.push('Max tokens must be between 100 and 100000');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new SettingsService();
