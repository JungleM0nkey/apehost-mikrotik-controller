/**
 * Settings Types
 */

export type AIProvider = 'claude' | 'cloudflare' | 'lmstudio';
export type ColorScheme = 'dark-orange' | 'classic-green' | 'cyan-blue' | 'custom';

export interface LMStudioConfig {
  serverUrl: string;
  endpointPath: string;
  apiKey?: string;
  modelName: string;
}

export interface RouterAPIConfig {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  useSsl: boolean;
  keepAlive: boolean;
  autoReconnect: boolean;
  connectionTimeout: number;
  commandTimeout: number;
  maxRetries: number;
  keepAliveInterval: number;
}

export interface AIAssistantConfig {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  responseTimeout: number;
  enableSuggestions: boolean;
  showExplanations: boolean;
  autoExecuteSafe: boolean;
  requireConfirmation: boolean;
}

export interface TerminalConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  syntaxHighlighting: boolean;
  lineNumbers: boolean;
  historyLimit: number;
  colorScheme: ColorScheme;
}

export interface SecurityConfig {
  storeCredentials: boolean;
  encryptCredentials: boolean;
  sessionTimeout: number;
  enableAuditLogging: boolean;
  logAiConversations: boolean;
  logRouterCommands: boolean;
}

export interface AdvancedConfig {
  debugMode: boolean;
  apiRequestLogging: boolean;
  useProxy: boolean;
  proxyUrl: string;
  proxyUsername?: string;
  proxyPassword?: string;
  maxRequestsPerMinute: number;
  throttleDelay: number;
}

export interface Settings {
  aiProvider: AIProvider;
  lmStudio: LMStudioConfig;
  routerApi: RouterAPIConfig;
  aiAssistant: AIAssistantConfig;
  terminal: TerminalConfig;
  security: SecurityConfig;
  advanced: AdvancedConfig;
}

export const defaultSettings: Settings = {
  aiProvider: 'lmstudio',
  lmStudio: {
    serverUrl: 'http://localhost:1234',
    endpointPath: '/v1/completions',
    apiKey: '',
    modelName: 'model-name'
  },
  routerApi: {
    ipAddress: '192.168.100.2',
    port: 8728,
    username: 'secureadmin',
    password: '',
    useSsl: false,
    keepAlive: true,
    autoReconnect: true,
    connectionTimeout: 10,
    commandTimeout: 30,
    maxRetries: 3,
    keepAliveInterval: 60
  },
  aiAssistant: {
    systemPrompt: 'You are an expert MikroTik router assistant. Help users configure and troubleshoot their MikroTik RouterOS devices. Be concise, accurate, and security-conscious.',
    temperature: 0.7,
    maxTokens: 2048,
    responseTimeout: 60,
    enableSuggestions: true,
    showExplanations: true,
    autoExecuteSafe: false,
    requireConfirmation: true
  },
  terminal: {
    fontFamily: 'JetBrains Mono',
    fontSize: 14,
    lineHeight: 1.5,
    syntaxHighlighting: true,
    lineNumbers: false,
    historyLimit: 1000,
    colorScheme: 'dark-orange'
  },
  security: {
    storeCredentials: false,
    encryptCredentials: true,
    sessionTimeout: 60,
    enableAuditLogging: true,
    logAiConversations: true,
    logRouterCommands: true
  },
  advanced: {
    debugMode: false,
    apiRequestLogging: false,
    useProxy: false,
    proxyUrl: '',
    proxyUsername: '',
    proxyPassword: '',
    maxRequestsPerMinute: 60,
    throttleDelay: 100
  }
};
