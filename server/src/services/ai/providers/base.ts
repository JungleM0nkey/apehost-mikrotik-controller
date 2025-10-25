/**
 * Base LLM Provider Interface
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SendMessageOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  tools?: ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface StreamMessageOptions extends SendMessageOptions {
  onChunk?: (chunk: string) => void;
  sessionId?: string;
  conversationId?: string;
  tools?: ToolDefinition[];
}

export interface ProviderCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  maxTokens: number;
  modelInfo: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MessageResponse {
  content: string;
  finishReason?: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  /**
   * Send a message and get a complete response
   */
  sendMessage(messages: Message[], options?: SendMessageOptions): Promise<MessageResponse>;

  /**
   * Stream a message response
   */
  streamMessage(messages: Message[], options?: StreamMessageOptions): AsyncGenerator<string, void, unknown>;

  /**
   * Validate provider configuration
   */
  validateConfig(): Promise<boolean>;

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities;

  /**
   * Get provider name
   */
  getName(): string;
}
