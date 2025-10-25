/**
 * Base MCP Tool Class
 *
 * Abstract base class that all MCP tools extend.
 * Provides common functionality for tool definition and validation.
 */

import type { MCPTool, ToolInputSchema, ToolDefinition, ToolResult, ToolExecutionContext } from './types.js';

export abstract class BaseMCPTool implements MCPTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: ToolInputSchema;

  /**
   * Execute the tool - must be implemented by subclasses
   */
  abstract execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;

  /**
   * Get tool definition in LLM-compatible format
   */
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      input_schema: this.inputSchema,
    };
  }

  /**
   * Validate input parameters against schema
   */
  protected validateInput(params: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required parameters
    if (this.inputSchema.required) {
      for (const requiredParam of this.inputSchema.required) {
        if (!(requiredParam in params)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Check parameter types
    for (const [paramName, paramValue] of Object.entries(params)) {
      const paramSchema = this.inputSchema.properties[paramName];
      if (!paramSchema) {
        errors.push(`Unknown parameter: ${paramName}`);
        continue;
      }

      // Type validation
      const actualType = Array.isArray(paramValue) ? 'array' : typeof paramValue;
      if (paramSchema.type !== actualType) {
        errors.push(`Parameter ${paramName} expected type ${paramSchema.type}, got ${actualType}`);
      }

      // Enum validation
      if (paramSchema.enum && !paramSchema.enum.includes(String(paramValue))) {
        errors.push(`Parameter ${paramName} must be one of: ${paramSchema.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create successful result
   */
  protected success(data: unknown, executionTime?: number): ToolResult {
    return {
      success: true,
      data,
      executionTime,
    };
  }

  /**
   * Create error result
   */
  protected error(error: string, executionTime?: number): ToolResult {
    return {
      success: false,
      error,
      executionTime,
    };
  }
}
