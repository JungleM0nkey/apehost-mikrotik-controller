/**
 * AI Assistant Types
 */

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: string;
}

export interface Conversation {
  id: string;
  messages: AssistantMessage[];
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

// Socket.IO event payloads
export interface AssistantMessagePayload {
  message: string;
  conversationId: string;
  context?: Record<string, any>;
}

export interface AssistantStreamPayload {
  chunk: string;
  conversationId: string;
  messageId: string;
}

export interface AssistantCompletePayload {
  conversationId: string;
  messageId: string;
  fullMessage: string;
}

export interface AssistantErrorPayload {
  error: string;
  conversationId: string;
  code?: string;
  canRetry?: boolean;
}

export interface AssistantTypingPayload {
  conversationId: string;
  isTyping: boolean;
}
