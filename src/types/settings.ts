/**
 * Settings Types
 */

export type AIProvider = 'claude' | 'lmstudio' | 'cloudflare';
export type ColorScheme = 'dark-orange' | 'classic-green' | 'cyan-blue' | 'custom';

// Server Settings (from backend API)
export interface ServerSettings {
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
  };
  llm: {
    provider: AIProvider;
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
  assistant: {
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
  };
}

// UI-Only Settings (stored in localStorage)
export interface UISettings {
  terminal: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    syntaxHighlighting: boolean;
    lineNumbers: boolean;
    historyLimit: number;
    colorScheme: ColorScheme;
  };
  display: {
    timezone: string;
    timeFormat: '12h' | '24h';
    dateFormat: string;
  };
  behavior: {
    enableSuggestions: boolean;
    showExplanations: boolean;
    autoExecuteSafe: boolean;
    requireConfirmation: boolean;
  };
  security: {
    storeCredentials: boolean;
    encryptCredentials: boolean;
    sessionTimeout: number;
    enableAuditLogging: boolean;
    logAiConversations: boolean;
    logRouterCommands: boolean;
  };
  aiAssistant: {
    sidePanelSections: {
      modelInfo: boolean;
      sessionInfo: boolean;
      mostUsedTools: boolean;
      availableTools: boolean;
    };
  };
}

// Combined Settings
export interface Settings {
  server: ServerSettings;
  ui: UISettings;
}

export const defaultUISettings: UISettings = {
  terminal: {
    fontFamily: 'JetBrains Mono',
    fontSize: 14,
    lineHeight: 1.5,
    syntaxHighlighting: true,
    lineNumbers: false,
    historyLimit: 1000,
    colorScheme: 'dark-orange'
  },
  display: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timeFormat: '12h',
    dateFormat: 'MMM DD, YYYY'
  },
  behavior: {
    enableSuggestions: true,
    showExplanations: true,
    autoExecuteSafe: false,
    requireConfirmation: true
  },
  security: {
    storeCredentials: false,
    encryptCredentials: true,
    sessionTimeout: 60,
    enableAuditLogging: true,
    logAiConversations: true,
    logRouterCommands: true
  },
  aiAssistant: {
    sidePanelSections: {
      modelInfo: true,
      sessionInfo: true,
      mostUsedTools: false,
      availableTools: true
    }
  }
};
