/**
 * Conversation Storage Utility
 * Handles persistence of AI assistant conversations in localStorage
 * Phase 1: Foundation - Metadata persistence
 */

import type { AssistantMessage } from '../types/assistant';

const STORAGE_PREFIX = 'assistant_conversation_';
const MAX_CONVERSATIONS = 10; // Limit number of stored conversations
const MAX_MESSAGES_PER_CONVERSATION = 100; // Prevent localStorage overflow

/**
 * Serializable version of AssistantMessage for localStorage
 */
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO string
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}

/**
 * Enhanced metadata for troubleshooting sessions
 * Matches server-side ConversationMetadata structure
 */
export interface ConversationMetadata {
  troubleshooting_session_id?: string;
  active_issue_ids?: string[];
  tools_called: Array<{
    tool_name: string;
    parameters: Record<string, any>;
    result: any;
    timestamp: number;
    success: boolean;
    execution_time?: number;
  }>;
  commands_executed: Array<{
    command: string;
    output: string;
    timestamp: number;
    success: boolean;
    error?: string;
  }>;
  identified_problems?: string[];
  attempted_solutions?: string[];
  resolution_status?: 'investigating' | 'resolved' | 'escalated';
  total_tool_calls?: number;
  total_commands?: number;
  session_start?: number;
  last_tool_call?: number;
  total_tokens?: number;
  total_cost?: number;
}

/**
 * Convert AssistantMessage to storable format
 */
function serializeMessage(message: AssistantMessage): StoredMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp.toISOString(),
    error: message.error,
    usage: message.usage,
  };
}

/**
 * Convert stored message back to AssistantMessage
 */
function deserializeMessage(stored: StoredMessage): AssistantMessage {
  return {
    id: stored.id,
    role: stored.role,
    content: stored.content,
    timestamp: new Date(stored.timestamp),
    error: stored.error,
    usage: stored.usage,
  };
}

/**
 * Save conversation messages and metadata to localStorage
 * Phase 1: Foundation - Enhanced with metadata persistence
 */
export function saveConversation(
  conversationId: string,
  messages: AssistantMessage[],
  metadata?: ConversationMetadata
): void {
  try {
    // Filter out streaming messages and limit message count
    const messagesToStore = messages
      .filter(msg => !msg.isStreaming)
      .slice(-MAX_MESSAGES_PER_CONVERSATION);

    const serialized = messagesToStore.map(serializeMessage);
    const key = STORAGE_PREFIX + conversationId;

    // Create default metadata if not provided
    const storedMetadata: ConversationMetadata = metadata || {
      tools_called: [],
      commands_executed: [],
      session_start: Date.now(),
      total_tool_calls: 0,
      total_commands: 0,
    };

    localStorage.setItem(key, JSON.stringify({
      conversationId,
      messages: serialized,
      metadata: storedMetadata,
      lastUpdated: new Date().toISOString(),
    }));

    // Clean up old conversations if needed
    cleanupOldConversations();
  } catch (error) {
    console.error('[ConversationStorage] Failed to save conversation:', error);
    // If localStorage is full, try to clean up
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      cleanupOldConversations();
      // Retry with fewer messages and limited metadata
      try {
        const limitedMessages = messages.slice(-50);
        const serialized = limitedMessages.map(serializeMessage);
        const key = STORAGE_PREFIX + conversationId;

        // Trim metadata to most recent items
        const trimmedMetadata: ConversationMetadata = {
          ...(metadata || {}),
          tools_called: (metadata?.tools_called || []).slice(-10),
          commands_executed: (metadata?.commands_executed || []).slice(-10),
        } as ConversationMetadata;

        localStorage.setItem(key, JSON.stringify({
          conversationId,
          messages: serialized,
          metadata: trimmedMetadata,
          lastUpdated: new Date().toISOString(),
        }));
      } catch (retryError) {
        console.error('[ConversationStorage] Failed to save even limited conversation:', retryError);
      }
    }
  }
}

/**
 * Load conversation messages and metadata from localStorage
 * Phase 1: Foundation - Enhanced with metadata loading
 */
export function loadConversation(conversationId: string): {
  messages: AssistantMessage[];
  metadata?: ConversationMetadata;
} {
  try {
    const key = STORAGE_PREFIX + conversationId;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return { messages: [] };
    }

    const data = JSON.parse(stored);

    if (!data.messages || !Array.isArray(data.messages)) {
      return { messages: [] };
    }

    const messages = data.messages.map(deserializeMessage);
    const metadata = data.metadata as ConversationMetadata | undefined;

    return { messages, metadata };
  } catch (error) {
    console.error('[ConversationStorage] Failed to load conversation:', error);
    return { messages: [] };
  }
}

/**
 * Clear a specific conversation
 */
export function clearConversation(conversationId: string): void {
  try {
    const key = STORAGE_PREFIX + conversationId;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[ConversationStorage] Failed to clear conversation:', error);
  }
}

/**
 * Get all stored conversation IDs sorted by last updated
 */
function getStoredConversations(): Array<{ id: string; lastUpdated: Date }> {
  const conversations: Array<{ id: string; lastUpdated: Date }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.lastUpdated) {
          conversations.push({
            id: key.replace(STORAGE_PREFIX, ''),
            lastUpdated: new Date(data.lastUpdated),
          });
        }
      } catch (error) {
        // Ignore invalid entries
      }
    }
  }

  return conversations.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
}

/**
 * Remove old conversations if we exceed the limit
 */
function cleanupOldConversations(): void {
  try {
    const conversations = getStoredConversations();

    // Keep only the most recent MAX_CONVERSATIONS
    if (conversations.length > MAX_CONVERSATIONS) {
      const toRemove = conversations.slice(MAX_CONVERSATIONS);
      toRemove.forEach(conv => {
        const key = STORAGE_PREFIX + conv.id;
        localStorage.removeItem(key);
      });
    }
  } catch (error) {
    console.error('[ConversationStorage] Failed to cleanup old conversations:', error);
  }
}

/**
 * Clear all stored conversations
 */
export function clearAllConversations(): void {
  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('[ConversationStorage] Failed to clear all conversations:', error);
  }
}
