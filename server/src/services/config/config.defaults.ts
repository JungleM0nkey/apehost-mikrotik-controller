/**
 * Default Configuration Values
 *
 * Central location for all default configuration values
 */

import type { AppConfig } from './config.schema.js';

export const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',

  server: {
    port: 3000,
    corsOrigin: 'http://localhost:5173',
    nodeEnv: 'development',
  },

  mikrotik: {
    host: '192.168.88.1',
    port: 8728,
    username: 'admin',
    password: '',
    timeout: 10000,
    keepaliveInterval: 30000,
  },

  llm: {
    provider: 'lmstudio',
    claude: {
      apiKey: '',
      model: 'claude-3-5-sonnet-20241022',
    },
    lmstudio: {
      endpoint: 'http://localhost:1234',
      model: '',
      contextWindow: 70752,
    },
  },

  assistant: {
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt:
      'You are an expert MikroTik router assistant. Help users configure and troubleshoot their MikroTik RouterOS devices. Be concise, accurate, and security-conscious.',
  },

  ui: {
    terminal: {
      fontFamily: 'JetBrains Mono',
      fontSize: 14,
      lineHeight: 1.5,
      syntaxHighlighting: true,
      lineNumbers: false,
      historyLimit: 1000,
      colorScheme: 'dark-orange',
    },
    display: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timeFormat: '12h',
      dateFormat: 'MMM DD, YYYY',
    },
    behavior: {
      enableSuggestions: true,
      showExplanations: true,
      autoExecuteSafe: false,
      requireConfirmation: true,
    },
    security: {
      storeCredentials: false,
      encryptCredentials: true,
      sessionTimeout: 60,
      enableAuditLogging: true,
      logAiConversations: true,
      logRouterCommands: true,
    },
  },
};
