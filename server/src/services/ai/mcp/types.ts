/**
 * MCP (Model Context Protocol) Types
 *
 * Defines the structure for tools that can be called by the LLM
 * to access MikroTik router data and execute safe commands.
 */

/**
 * JSON Schema for tool input parameters
 * Following JSON Schema Draft 7 specification
 * Compatible with Anthropic's tool calling format
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
    items?: Record<string, unknown>;
  }>;
  required?: string[];
  [key: string]: unknown; // Allow additional properties for Anthropic compatibility
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime?: number;
}

/**
 * Tool definition for LLM consumption
 * Compatible with Anthropic's tool calling format
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
}

/**
 * Tool call request from LLM
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  sessionId: string;
  conversationId: string;
  timestamp: Date;
}

/**
 * Audit log entry for tool execution
 */
export interface ToolAuditEntry {
  toolName: string;
  sessionId: string;
  conversationId: string;
  input: Record<string, unknown>;
  result: ToolResult;
  timestamp: Date;
  executionTime: number;
}

/**
 * Base interface that all MCP tools must implement
 */
export interface MCPTool {
  /**
   * Unique tool identifier
   */
  readonly name: string;

  /**
   * Human-readable description for the LLM
   */
  readonly description: string;

  /**
   * JSON Schema defining the tool's input parameters
   */
  readonly inputSchema: ToolInputSchema;

  /**
   * Execute the tool with given parameters
   */
  execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;

  /**
   * Get tool definition for LLM consumption
   */
  getDefinition(): ToolDefinition;
}
