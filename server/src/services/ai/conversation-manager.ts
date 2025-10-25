/**
 * Conversation Manager
 * Handles conversation state and message history
 */

import type { Message } from './providers/base.js';

export interface ConversationMessage extends Message {
  id: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  messages: ConversationMessage[];
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private readonly MAX_MESSAGES_PER_CONVERSATION = 40; // 20 exchanges (user + assistant)
  private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Create or get existing conversation
   */
  getOrCreateConversation(conversationId: string): Conversation {
    if (this.conversations.has(conversationId)) {
      const conversation = this.conversations.get(conversationId)!;
      conversation.lastActivity = new Date();
      return conversation;
    }

    const conversation: Conversation = {
      id: conversationId,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.conversations.set(conversationId, conversation);
    console.log(`[ConversationManager] Created conversation: ${conversationId}`);

    // Add system prompt for new conversations
    this.initializeSystemPrompt(conversationId);

    return conversation;
  }

  /**
   * Initialize conversation with system prompt
   */
  private initializeSystemPrompt(conversationId: string): void {
    const systemPrompt = `You are a helpful AI assistant for managing MikroTik routers. You have access to tools that allow you to:

1. Get router system information (CPU, memory, uptime, version)
2. View network interfaces and their status
3. Check DHCP leases and connected devices
4. View routing table
5. Examine firewall rules
6. Execute safe, read-only RouterOS commands

When users ask questions about their router, use the appropriate tools to gather real-time information. Provide clear, helpful explanations and actionable advice.

Guidelines:
- Always use tools to get current data rather than making assumptions
- Explain technical concepts in an accessible way
- Suggest improvements or potential issues you notice
- If multiple tools are needed, use them systematically
- Be concise but thorough in your responses

You can only execute read-only commands. Write operations, user management, and system control commands are not allowed for security reasons.`;

    this.addMessage(conversationId, 'system', systemPrompt);
  }

  /**
   * Add message to conversation
   */
  addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string): ConversationMessage {
    const conversation = this.getOrCreateConversation(conversationId);

    const message: ConversationMessage = {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: new Date(),
    };

    conversation.messages.push(message);
    conversation.lastActivity = new Date();

    // Trim old messages if exceeded limit (keep system messages)
    if (conversation.messages.length > this.MAX_MESSAGES_PER_CONVERSATION) {
      const systemMessages = conversation.messages.filter(m => m.role === 'system');
      const otherMessages = conversation.messages.filter(m => m.role !== 'system');

      // Keep last N non-system messages
      const trimmedOthers = otherMessages.slice(-this.MAX_MESSAGES_PER_CONVERSATION + systemMessages.length);
      conversation.messages = [...systemMessages, ...trimmedOthers];

      console.log(
        `[ConversationManager] Trimmed conversation ${conversationId} to ${conversation.messages.length} messages`
      );
    }

    return message;
  }

  /**
   * Get conversation history formatted for LLM
   */
  getMessagesForLLM(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Get conversation
   */
  getConversation(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Clear conversation history
   */
  clearConversation(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.messages = [];
      conversation.lastActivity = new Date();
      console.log(`[ConversationManager] Cleared conversation: ${conversationId}`);
    }
  }

  /**
   * Delete conversation
   */
  deleteConversation(conversationId: string): void {
    if (this.conversations.has(conversationId)) {
      this.conversations.delete(conversationId);
      console.log(`[ConversationManager] Deleted conversation: ${conversationId}`);
    }
  }

  /**
   * Clean up expired conversations
   */
  cleanupExpiredConversations(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [conversationId, conversation] of this.conversations.entries()) {
      if (now - conversation.lastActivity.getTime() > this.CONVERSATION_TIMEOUT) {
        this.conversations.delete(conversationId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[ConversationManager] Cleaned up ${cleaned} expired conversations`);
    }
  }

  /**
   * Get active conversation count
   */
  getActiveConversationCount(): number {
    return this.conversations.size;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const conversationManager = new ConversationManager();
export default conversationManager;
