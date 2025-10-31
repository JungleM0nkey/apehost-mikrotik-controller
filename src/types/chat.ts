/**
 * Chat Message Types
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
  sender: 'user' | 'assistant';
  tokenUsage?: TokenUsage;
}

export interface QuickAction {
  id: string;
  label: string;
  command?: string;
}
