/**
 * Configuration Schema Definitions
 *
 * Zod schemas for runtime validation of configuration
 */

import { z } from 'zod';

// Server Configuration Schema
export const ServerConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  corsOrigin: z.string().min(1),
  nodeEnv: z.enum(['development', 'production', 'test']),
});

// MikroTik Configuration Schema
export const MikroTikConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string(),
  timeout: z.number().int().min(1000).max(60000),
  keepaliveInterval: z.number().int().min(5000).max(300000),
});

// LLM Configuration Schema
export const LLMConfigSchema = z.object({
  provider: z.enum(['claude', 'lmstudio', 'cloudflare']),
  claude: z.object({
    apiKey: z.string(),
    model: z.string(),
  }),
  lmstudio: z.object({
    endpoint: z.string().refine((val) => val === '' || z.string().url().safeParse(val).success, {
      message: 'Must be a valid URL or empty string',
    }),
    model: z.string(),
    contextWindow: z.number().int().min(1024).default(32768),
  }),
  cloudflare: z.object({
    accountId: z.string(),
    apiToken: z.string(),
    model: z.string(),
    gateway: z.string().optional(),
  }).optional(),
});

// Assistant Configuration Schema
export const AssistantConfigSchema = z.object({
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(100).max(100000),
  systemPrompt: z.string(),
});

// UI Terminal Configuration Schema
export const UITerminalConfigSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number().int().min(8).max(32),
  lineHeight: z.number().min(1).max(3),
  syntaxHighlighting: z.boolean(),
  lineNumbers: z.boolean(),
  historyLimit: z.number().int().min(100).max(10000),
  colorScheme: z.enum(['dark-orange', 'classic-green', 'cyan-blue', 'custom']),
});

// UI Display Configuration Schema
export const UIDisplayConfigSchema = z.object({
  timezone: z.string(),
  timeFormat: z.enum(['12h', '24h']),
  dateFormat: z.string(),
});

// UI Behavior Configuration Schema
export const UIBehaviorConfigSchema = z.object({
  enableSuggestions: z.boolean(),
  showExplanations: z.boolean(),
  autoExecuteSafe: z.boolean(),
  requireConfirmation: z.boolean(),
});

// UI Security Configuration Schema
export const UISecurityConfigSchema = z.object({
  storeCredentials: z.boolean(),
  encryptCredentials: z.boolean(),
  sessionTimeout: z.number().int().min(5).max(1440),
  enableAuditLogging: z.boolean(),
  logAiConversations: z.boolean(),
  logRouterCommands: z.boolean(),
});

// UI Configuration Schema
export const UIConfigSchema = z.object({
  terminal: UITerminalConfigSchema,
  display: UIDisplayConfigSchema,
  behavior: UIBehaviorConfigSchema,
  security: UISecurityConfigSchema,
});

// Main Application Configuration Schema
export const AppConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  server: ServerConfigSchema,
  mikrotik: MikroTikConfigSchema,
  llm: LLMConfigSchema,
  assistant: AssistantConfigSchema,
  ui: UIConfigSchema,
});

// TypeScript types inferred from schemas
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type MikroTikConfig = z.infer<typeof MikroTikConfigSchema>;
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
export type AssistantConfig = z.infer<typeof AssistantConfigSchema>;
export type UITerminalConfig = z.infer<typeof UITerminalConfigSchema>;
export type UIDisplayConfig = z.infer<typeof UIDisplayConfigSchema>;
export type UIBehaviorConfig = z.infer<typeof UIBehaviorConfigSchema>;
export type UISecurityConfig = z.infer<typeof UISecurityConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

// Config sections enum
export type ConfigSection = 'server' | 'mikrotik' | 'llm' | 'assistant' | 'ui';

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
