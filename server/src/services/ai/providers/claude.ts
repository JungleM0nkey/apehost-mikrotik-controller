/**
 * Claude (Anthropic) LLM Provider with MCP Tool Calling Support
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  Message,
  SendMessageOptions,
  StreamMessageOptions,
  ProviderCapabilities,
  MessageResponse,
} from './base.js';
import { ConfigError, APIError, NetworkError, RateLimitError, StreamingError } from '../errors/index.js';
import { globalMCPExecutor } from '../mcp/mcp-executor.js';
import type { ToolExecutionContext } from '../mcp/types.js';

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;
  private defaultMaxTokens: number;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      throw new ConfigError('Invalid Anthropic API key format. Must start with sk-ant-');
    }

    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.defaultMaxTokens = 4096;
  }

  async sendMessage(messages: Message[], options?: SendMessageOptions): Promise<MessageResponse> {
    try {
      // Separate system messages from conversation
      const systemMessage = messages.find(m => m.role === 'system')?.content || options?.systemPrompt;
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens || this.defaultMaxTokens,
        temperature: options?.temperature,
        system: systemMessage,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      return {
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        finishReason: response.stop_reason || undefined,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
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
      // Separate system messages from conversation
      const systemMessage = messages.find(m => m.role === 'system')?.content || options?.systemPrompt;
      let conversationMessages = messages.filter(m => m.role !== 'system');

      // Get MCP tool definitions if available
      const toolDefinitions = globalMCPExecutor.getToolDefinitions();
      const hasTools = toolDefinitions.length > 0;

      // Multi-turn tool calling loop
      let maxToolTurns = 5; // Prevent infinite loops
      let currentTurn = 0;

      while (currentTurn < maxToolTurns) {
        currentTurn++;

        const stream = await this.client.messages.stream({
          model: this.model,
          max_tokens: options?.maxTokens || this.defaultMaxTokens,
          temperature: options?.temperature,
          system: systemMessage,
          messages: conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          ...(hasTools && { tools: toolDefinitions }),
        });

        let hasToolUse = false;
        const toolCalls: Array<{ id: string; name: string; input: any }> = [];
        let assistantMessage = '';

        // Process stream events
        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              hasToolUse = true;
              toolCalls.push({
                id: event.content_block.id,
                name: event.content_block.name,
                input: event.content_block.input,
              });
            }
          }

          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              const chunk = event.delta.text;
              assistantMessage += chunk;
              if (options?.onChunk) {
                options.onChunk(chunk);
              }
              yield chunk;
            }
          }
        }

        // If no tool use, we're done
        if (!hasToolUse || toolCalls.length === 0) {
          break;
        }

        // Execute tools
        console.log(`[ClaudeProvider] Executing ${toolCalls.length} tool calls`);
        const toolResults: Array<{ tool_use_id: string; type: 'tool_result'; content: string; is_error?: boolean }> = [];

        for (const toolCall of toolCalls) {
          const context: ToolExecutionContext = {
            sessionId: options?.sessionId || 'default',
            conversationId: options?.conversationId || 'default',
            timestamp: new Date(),
          };

          const result = await globalMCPExecutor.executeTool(
            { id: toolCall.id, name: toolCall.name, input: toolCall.input },
            context
          );

          toolResults.push({
            tool_use_id: toolCall.id,
            type: 'tool_result',
            content: result.success
              ? JSON.stringify(result.data, null, 2)
              : `Error: ${result.error}`,
            is_error: !result.success,
          });
        }

        // Add tool results to conversation and continue
        conversationMessages = [
          ...conversationMessages,
          {
            role: 'assistant' as const,
            content: JSON.stringify({ tool_calls: toolCalls }),
          },
          {
            role: 'user' as const,
            content: JSON.stringify({ tool_results: toolResults }),
          },
        ];
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Simple validation: try to list available models
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error: any) {
      console.error('[ClaudeProvider] Config validation failed:', error.message);
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true, // Claude supports function calling (for Phase 2)
      maxTokens: 200000, // Claude 3.5 Sonnet context window
      modelInfo: this.model,
    };
  }

  getName(): string {
    return 'Claude';
  }

  private handleError(error: any): Error {
    if (error.status === 401) {
      return new ConfigError('Invalid Anthropic API key. Check ANTHROPIC_API_KEY in .env');
    }

    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'];
      return new RateLimitError(
        'Claude API rate limit exceeded. Please wait and try again.',
        retryAfter ? parseInt(retryAfter) : undefined
      );
    }

    if (error.status === 400) {
      return new APIError('Invalid request to Claude API', error.status);
    }

    if (error.status === 500 || error.status === 503) {
      return new APIError('Claude API service error', error.status, true);
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new NetworkError('Failed to connect to Claude API. Check your internet connection.', true);
    }

    // Generic error
    return new APIError(error.message || 'Claude API error', error.status);
  }
}
