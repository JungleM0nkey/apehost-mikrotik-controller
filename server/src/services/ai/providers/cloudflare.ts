/**
 * Cloudflare Workers AI Provider with Function Calling Support
 * Model: @cf/meta/llama-4-scout-17b-16e-instruct
 */

import type {
  LLMProvider,
  Message,
  SendMessageOptions,
  StreamMessageOptions,
  ProviderCapabilities,
  MessageResponse,
  ToolDefinition,
} from './base.js';
import { ConfigError, APIError, NetworkError, RateLimitError, StreamingError } from '../errors/index.js';
import { globalMCPExecutor } from '../mcp/mcp-executor.js';
import type { ToolExecutionContext } from '../mcp/types.js';

interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  model?: string;
  gateway?: string; // Optional: AI Gateway name for caching/analytics
}

interface CloudflareMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CloudflareTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

interface CloudflareToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

interface CloudflareResponse {
  response: string;
  tool_calls?: CloudflareToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class CloudflareProvider implements LLMProvider {
  private accountId: string;
  private apiToken: string;
  private model: string;
  private baseUrl: string;
  private defaultMaxTokens: number;

  constructor(config: CloudflareConfig) {
    if (!config.accountId) {
      throw new ConfigError('Cloudflare Account ID is required');
    }
    if (!config.apiToken) {
      throw new ConfigError('Cloudflare API Token is required');
    }

    this.accountId = config.accountId;
    this.apiToken = config.apiToken;
    this.model = config.model || '@cf/meta/llama-4-scout-17b-16e-instruct';

    // Use AI Gateway if configured for caching/rate limiting
    if (config.gateway) {
      this.baseUrl = `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${config.gateway}/workers-ai/${this.model}`;
    } else {
      this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`;
    }

    this.defaultMaxTokens = 4096;
  }

  async sendMessage(messages: Message[], options?: SendMessageOptions): Promise<MessageResponse> {
    try {
      const formattedMessages = this.formatMessages(messages, options?.systemPrompt);
      const tools = options?.tools ? this.convertToolDefinitions(options.tools) : undefined;

      const requestBody: any = {
        messages: formattedMessages,
        max_tokens: options?.maxTokens || this.defaultMaxTokens,
        stream: false,
      };

      if (options?.temperature !== undefined) {
        requestBody.temperature = options.temperature;
      }

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw await this.handleHTTPError(response);
      }

      const data: any = await response.json();
      const result = data.result as CloudflareResponse;

      return {
        content: result.response || '',
        finishReason: result.tool_calls ? 'tool_calls' : 'stop',
        toolCalls: result.tool_calls?.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
        usage: result.usage ? {
          promptTokens: result.usage.prompt_tokens,
          completionTokens: result.usage.completion_tokens,
          totalTokens: result.usage.total_tokens,
        } : undefined,
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
      let conversationMessages = this.formatMessages(messages, options?.systemPrompt);

      // Get MCP tool definitions if available
      const toolDefinitions = globalMCPExecutor.getToolDefinitions();
      const hasTools = toolDefinitions.length > 0;
      const tools = hasTools ? this.convertToolDefinitions(toolDefinitions) : undefined;

      // Multi-turn tool calling loop (similar to Claude provider)
      let maxToolTurns = 5; // Prevent infinite loops
      let currentTurn = 0;

      while (currentTurn < maxToolTurns) {
        currentTurn++;

        const requestBody: any = {
          messages: conversationMessages,
          max_tokens: options?.maxTokens || this.defaultMaxTokens,
          stream: true,
        };

        if (options?.temperature !== undefined) {
          requestBody.temperature = options.temperature;
        }

        if (tools && tools.length > 0) {
          requestBody.tools = tools;
        }

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw await this.handleHTTPError(response);
        }

        if (!response.body) {
          throw new StreamingError('Response body is null');
        }

        // Parse Server-Sent Events (SSE)
        let hasToolUse = false;
        const toolCalls: CloudflareToolCall[] = [];
        let assistantMessage = '';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;

              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const data = JSON.parse(dataStr);

                // Handle text delta
                if (data.response) {
                  const text = data.response;
                  assistantMessage += text;
                  if (options?.onChunk) {
                    options.onChunk(text);
                  }
                  yield text;
                }

                // Handle tool calls
                if (data.tool_calls && data.tool_calls.length > 0) {
                  hasToolUse = true;
                  toolCalls.push(...data.tool_calls);
                }
              } catch (parseError) {
                console.warn('[CloudflareProvider] Failed to parse SSE data:', parseError);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // If no tool use, we're done
        if (!hasToolUse || toolCalls.length === 0) {
          break;
        }

        // Execute tools
        console.log(`[CloudflareProvider] Executing ${toolCalls.length} tool calls`);
        const toolResults: Array<{ role: 'tool'; tool_call_id: string; content: string }> = [];

        for (const toolCall of toolCalls) {
          const context: ToolExecutionContext = {
            sessionId: options?.sessionId || 'default',
            conversationId: options?.conversationId || 'default',
            timestamp: new Date(),
          };

          let input: any;
          try {
            input = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            input = {};
          }

          const result = await globalMCPExecutor.executeTool(
            { id: toolCall.id, name: toolCall.function.name, input },
            context
          );

          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.success
              ? JSON.stringify(result.data, null, 2)
              : `Error: ${result.error}`,
          });
        }

        // Add assistant message with tool calls
        conversationMessages.push({
          role: 'assistant',
          content: assistantMessage || 'Using tools...',
        });

        // Add tool results as user messages (Cloudflare format)
        for (const toolResult of toolResults) {
          conversationMessages.push({
            role: 'user',
            content: `Tool result for ${toolResult.tool_call_id}:\n${toolResult.content}`,
          });
        }
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10,
          stream: false,
        }),
      });

      return response.ok;
    } catch (error: any) {
      console.error('[CloudflareProvider] Config validation failed:', error.message);
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true, // llama-4-scout supports function calling
      maxTokens: 131072, // 131K context window
      modelInfo: this.model,
    };
  }

  getName(): string {
    return 'Cloudflare Workers AI';
  }

  /**
   * Format messages for Cloudflare API
   */
  private formatMessages(messages: Message[], systemPrompt?: string): CloudflareMessage[] {
    const formatted: CloudflareMessage[] = [];

    // Add system message if provided
    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation messages (skip system messages from input)
    for (const msg of messages) {
      if (msg.role !== 'system') {
        formatted.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    return formatted;
  }

  /**
   * Convert MCP tool definitions to Cloudflare format
   */
  private convertToolDefinitions(tools: ToolDefinition[]): CloudflareTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  /**
   * Handle HTTP errors from Cloudflare API
   */
  private async handleHTTPError(response: Response): Promise<Error> {
    let errorMessage = `Cloudflare API error: ${response.status} ${response.statusText}`;

    try {
      const errorData = await response.json() as any;
      if (errorData.errors && errorData.errors.length > 0) {
        errorMessage = errorData.errors[0].message || errorMessage;
      }
    } catch (e) {
      // Couldn't parse error response
    }

    if (response.status === 401) {
      return new ConfigError('Invalid Cloudflare API token. Check CLOUDFLARE_API_TOKEN in .env');
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      return new RateLimitError(
        'Cloudflare API rate limit exceeded (300 requests/min). Please wait and try again.',
        retryAfter ? parseInt(retryAfter) : undefined
      );
    }

    if (response.status === 400) {
      return new APIError(`Invalid request to Cloudflare API: ${errorMessage}`, response.status);
    }

    if (response.status === 500 || response.status === 503) {
      return new APIError('Cloudflare API service error', response.status, true);
    }

    return new APIError(errorMessage, response.status);
  }

  /**
   * Handle general errors
   */
  private handleError(error: any): Error {
    if (error instanceof ConfigError ||
        error instanceof APIError ||
        error instanceof RateLimitError ||
        error instanceof StreamingError) {
      return error;
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new NetworkError('Failed to connect to Cloudflare API. Check your internet connection.', true);
    }

    // Generic error
    return new APIError(error.message || 'Cloudflare API error');
  }
}
