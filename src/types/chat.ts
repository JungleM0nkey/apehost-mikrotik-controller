/**
 * Chat Message Types
 */

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
  sender: 'user' | 'assistant';
}

export interface QuickAction {
  id: string;
  label: string;
  command?: string;
}
