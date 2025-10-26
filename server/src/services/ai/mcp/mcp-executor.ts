/**
 * MCP Executor Service
 *
 * Central orchestrator for MCP tool execution.
 * Handles tool registration, security checks, rate limiting, and execution.
 */

import type {
  MCPTool,
  ToolCall,
  ToolResult,
  ToolExecutionContext,
  ToolDefinition,
  ToolAuditEntry,
} from './types.js';
import { globalRateLimiter } from './security/rate-limiter.js';
import { globalAuditLogger } from './security/audit-logger.js';

// Import all tool implementations
import { RouterInfoTool } from './tools/router-info-tool.js';
import { InterfacesTool } from './tools/interfaces-tool.js';
import { DHCPTool } from './tools/dhcp-tool.js';
import { RoutesTool } from './tools/routes-tool.js';
import { FirewallTool } from './tools/firewall-tool.js';
import { SafeCommandTool } from './tools/safe-command-tool.js';
import { TrafficTool } from './tools/traffic-tool.js';
import { WirelessTool } from './tools/wireless-tool.js';
import { SystemTool } from './tools/system-tool.js';
import { LogsTool } from './tools/logs-tool.js';
import { DiagnosticsTool } from './tools/diagnostics-tool.js';
import { ConnectivityTool } from './tools/connectivity-tool.js';
import { NetworkTool } from './tools/network-tool.js';

export class MCPExecutor {
  private tools: Map<string, MCPTool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Register all default tools
   */
  private registerDefaultTools(): void {
    // Core network tools
    this.registerTool(new RouterInfoTool());
    this.registerTool(new InterfacesTool());
    this.registerTool(new DHCPTool());
    this.registerTool(new RoutesTool());
    this.registerTool(new FirewallTool());

    // Network troubleshooting tools
    this.registerTool(new ConnectivityTool());
    this.registerTool(new NetworkTool());

    // Traffic and bandwidth monitoring
    this.registerTool(new TrafficTool());

    // Wireless management
    this.registerTool(new WirelessTool());

    // System resources and monitoring
    this.registerTool(new SystemTool());
    this.registerTool(new LogsTool());

    // Advanced command execution
    this.registerTool(new SafeCommandTool());

    // AI Agent diagnostics
    this.registerTool(new DiagnosticsTool());

    console.log(`[MCPExecutor] Registered ${this.tools.size} tools`);
  }

  /**
   * Register a tool
   */
  registerTool(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[MCPExecutor] Tool ${tool.name} already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
    console.log(`[MCPExecutor] Registered tool: ${tool.name}`);
  }

  /**
   * Get all tool definitions for LLM consumption
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  /**
   * Execute a tool call with security checks
   */
  async executeTool(toolCall: ToolCall, context: ToolExecutionContext): Promise<ToolResult> {
    const { name, input, id } = toolCall;
    const startTime = Date.now();

    try {
      // Check rate limit
      if (!globalRateLimiter.check(context.sessionId)) {
        const remaining = globalRateLimiter.getRemaining(context.sessionId);
        return {
          success: false,
          error: `Rate limit exceeded. Please wait before making more tool calls. Remaining: ${remaining}`,
        };
      }

      // Get tool
      const tool = this.tools.get(name);
      if (!tool) {
        return {
          success: false,
          error: `Unknown tool: ${name}. Available tools: ${Array.from(this.tools.keys()).join(', ')}`,
        };
      }

      console.log(`[MCPExecutor] Executing tool: ${name} (call ID: ${id})`);

      // Execute tool
      const result = await tool.execute(input, context);

      // Audit log
      const auditEntry: ToolAuditEntry = {
        toolName: name,
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        input,
        result,
        timestamp: context.timestamp,
        executionTime: Date.now() - startTime,
      };
      globalAuditLogger.log(auditEntry);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[MCPExecutor] Tool execution error:`, error);

      const errorResult: ToolResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
        executionTime,
      };

      // Audit log the error
      const auditEntry: ToolAuditEntry = {
        toolName: name,
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        input,
        result: errorResult,
        timestamp: context.timestamp,
        executionTime,
      };
      globalAuditLogger.log(auditEntry);

      return errorResult;
    }
  }

  /**
   * Execute multiple tool calls in sequence
   */
  async executeToolCalls(toolCalls: ToolCall[], context: ToolExecutionContext): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeTool(toolCall, context);
      results.push(result);

      // Stop execution if a tool fails critically
      if (!result.success && result.error?.includes('Rate limit')) {
        break;
      }
    }

    return results;
  }

  /**
   * Get tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all available tools
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get statistics
   */
  getStats(): {
    toolCount: number;
    auditStats: ReturnType<typeof globalAuditLogger.getStats>;
  } {
    return {
      toolCount: this.tools.size,
      auditStats: globalAuditLogger.getStats(),
    };
  }
}

// Global MCP executor instance
export const globalMCPExecutor = new MCPExecutor();
