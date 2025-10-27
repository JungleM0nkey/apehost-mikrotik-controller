/**
 * LM Studio (Local LLM) Provider - OpenAI Compatible API
 */

import OpenAI from 'openai';
import type {
  LLMProvider,
  Message,
  SendMessageOptions,
  StreamMessageOptions,
  ProviderCapabilities,
  MessageResponse,
} from './base.js';
import { ConfigError, APIError, NetworkError, StreamingError } from '../errors/index.js';

export class LMStudioProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;
  private endpoint: string;
  private contextWindow: number;

  constructor(endpoint: string, model: string) {
    if (!endpoint) {
      throw new ConfigError('LM Studio endpoint is required. Set LMSTUDIO_ENDPOINT in .env');
    }

    if (!model) {
      throw new ConfigError('LM Studio model is required. Set LMSTUDIO_MODEL in .env');
    }

    this.endpoint = endpoint;
    this.model = model;
    this.defaultMaxTokens = 2048;

    // Use environment variable if provided, otherwise fallback to default
    const envContextWindow = process.env.LMSTUDIO_CONTEXT_WINDOW;
    this.contextWindow = envContextWindow ? parseInt(envContextWindow, 10) : 32768;

    console.log(`[LMStudioProvider] Context window configured: ${this.contextWindow}`);

    // Create OpenAI client with custom endpoint
    this.client = new OpenAI({
      baseURL: endpoint,
      apiKey: 'not-needed', // LM Studio doesn't require API key
    });
  }

  async sendMessage(messages: Message[], options?: SendMessageOptions): Promise<MessageResponse> {
    try {
      // OpenAI format includes system messages in the messages array
      let formattedMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Prepend systemPrompt as a system message if provided
      if (options?.systemPrompt) {
        formattedMessages = [
          { role: 'system' as const, content: options.systemPrompt },
          ...formattedMessages,
        ];
      }

      const requestParams: any = {
        model: this.model,
        messages: formattedMessages,
        max_tokens: options?.maxTokens || this.defaultMaxTokens,
      };

      // Only add temperature if it's defined
      if (options?.temperature !== undefined) {
        requestParams.temperature = options.temperature;
      }

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        requestParams.tools = options.tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        }));
        requestParams.tool_choice = 'auto';
      }

      // Log request details for debugging
      console.log('[LMStudioProvider] Request:', {
        model: requestParams.model,
        messageCount: requestParams.messages.length,
        maxTokens: requestParams.max_tokens,
        temperature: requestParams.temperature,
        toolCount: requestParams.tools?.length || 0,
        hasSystemMessage: requestParams.messages[0]?.role === 'system',
      });

      const response = await this.client.chat.completions.create(requestParams);

      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

      return {
        content: choice.message.content || '',
        finishReason: choice.finish_reason || undefined,
        toolCalls: toolCalls,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async *streamMessage(
    messages: Message[],
    options?: StreamMessageOptions
  ): AsyncGenerator<string, void, unknown> {
    try {
      // OpenAI format includes system messages in the messages array
      let formattedMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Prepend systemPrompt as a system message if provided
      if (options?.systemPrompt) {
        formattedMessages = [
          { role: 'system' as const, content: options.systemPrompt },
          ...formattedMessages,
        ];
      }

      const requestParams: any = {
        model: this.model,
        messages: formattedMessages,
        max_tokens: options?.maxTokens || this.defaultMaxTokens,
        stream: true,
      };

      // Only add temperature if it's defined
      if (options?.temperature !== undefined) {
        requestParams.temperature = options.temperature;
      }

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        requestParams.tools = options.tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        }));
        requestParams.tool_choice = 'auto';
      }

      // Log request details for debugging
      console.log('[LMStudioProvider] Stream request:', {
        model: requestParams.model,
        messageCount: requestParams.messages.length,
        maxTokens: requestParams.max_tokens,
        temperature: requestParams.temperature,
        toolCount: requestParams.tools?.length || 0,
        hasSystemMessage: requestParams.messages[0]?.role === 'system',
      });

      const stream = await this.client.chat.completions.create(requestParams) as any;

      let toolCalls: any[] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle regular text content
        const content = delta?.content;
        if (content) {
          if (options?.onChunk) {
            options.onChunk(content);
          }
          yield content;
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          // Accumulate tool calls
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index || 0;
            if (!toolCalls[index]) {
              toolCalls[index] = {
                id: toolCall.id || `call_${Date.now()}`,
                type: 'function',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || '',
                },
              };
            } else {
              // Accumulate arguments
              if (toolCall.function?.arguments) {
                toolCalls[index].function.arguments += toolCall.function.arguments;
              }
            }
          }
        }
      }

      // If we have tool calls, we need to signal that (but we can't in a generator that yields strings)
      // This is a limitation - we'd need to refactor to yield objects instead of strings
      // For now, tool calls will be lost in streaming mode
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Test connection by listing models
      const response = await fetch(`${this.endpoint}/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        console.error('[LMStudioProvider] Config validation failed: HTTP', response.status);
        return false;
      }

      const data: any = await response.json();
      const models = data.data || [];

      if (models.length === 0) {
        console.error('[LMStudioProvider] No models loaded in LM Studio');
        return false;
      }

      // Find the loaded model and extract its context window
      const loadedModel = models.find((m: any) => m.id === this.model);

      if (loadedModel) {
        // Extract context_window from model metadata
        // LM Studio may provide this in different fields
        this.contextWindow = loadedModel.context_length ||
                            loadedModel.context_window ||
                            loadedModel.max_context_length ||
                            32768; // Fallback
        console.log(`[LMStudioProvider] Model '${this.model}' loaded with context window: ${this.contextWindow}`);
      } else {
        const availableModels = models.map((m: any) => m.id);
        console.warn(`[LMStudioProvider] Model '${this.model}' not found in loaded models:`, availableModels);
        console.warn('[LMStudioProvider] Using first available model');

        // Use first available model's context window
        const firstModel = models[0];
        this.contextWindow = firstModel.context_length ||
                            firstModel.context_window ||
                            firstModel.max_context_length ||
                            32768;
      }

      return true;
    } catch (error: any) {
      console.error('[LMStudioProvider] Config validation failed:', error.message);
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true, // Qwen and other modern models support function calling via OpenAI format
      maxTokens: this.contextWindow, // Actual context window from loaded model
      modelInfo: this.model,
    };
  }

  getName(): string {
    return 'LM Studio';
  }

  private handleError(error: any): Error {
    // Log full error details for debugging
    console.error('[LMStudioProvider] Full error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      response: error.response?.data,
      error: error.error,
    });

    if (error.code === 'ECONNREFUSED') {
      return new NetworkError(
        `Failed to connect to LM Studio at ${this.endpoint}. Make sure LM Studio is running.`,
        false
      );
    }

    if (error.code === 'ETIMEDOUT') {
      return new NetworkError('LM Studio connection timeout. The model might be loading.', true);
    }

    if (error.status === 404) {
      return new ConfigError(`Model '${this.model}' not found in LM Studio. Load the model first.`);
    }

    if (error.status === 400) {
      const detailMsg = error.message || error.error?.message || error.response?.data?.error?.message;
      return new APIError(`Invalid request to LM Studio: ${detailMsg}`, error.status);
    }

    if (error.status === 500) {
      return new APIError('LM Studio internal error. Check the LM Studio logs.', error.status, true);
    }

    // Generic error
    return new APIError(error.message || 'LM Studio error', error.status);
  }
}
