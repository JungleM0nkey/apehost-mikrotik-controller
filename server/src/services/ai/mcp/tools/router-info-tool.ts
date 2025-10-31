/**
 * Router Info Tool
 *
 * Retrieves system information about the MikroTik router including:
 * - CPU and memory usage
 * - Uptime
 * - RouterOS version
 * - Router identity/hostname
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class RouterInfoTool extends BaseMCPTool {
  readonly name = 'get_router_info';
  readonly description =
    '[DEPRECATED] Use get_system_resources with type="identity" or type="resources" instead. This tool is maintained for backward compatibility only and will be removed in a future release. Get basic system information about the MikroTik router including CPU usage, memory usage, uptime, RouterOS version, and router hostname. Use this when the user asks about CPU usage, memory usage, system uptime, RouterOS version, or router identity. DO NOT use for network speed tests, bandwidth testing, or internet performance measurement.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Log deprecation warning
    console.warn(
      `[RouterInfoTool] ⚠️ DEPRECATED: get_router_info called from conversation ${context.conversationId}. ` +
      `Use get_system_resources with type="identity" or type="resources" instead.`
    );

    const startTime = Date.now();

    try {
      // Validate input (no params required)
      const validation = this.validateInput(params);
      if (!validation.valid) {
        return this.error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      if (!mikrotikService) {
        return this.error('MikroTik service not available');
      }

      // Execute multiple commands to gather system info
      const [resourceOutput, identityOutput] = await Promise.all([
        mikrotikService.executeTerminalCommand('/system resource print'),
        mikrotikService.executeTerminalCommand('/system identity print'),
      ]);

      // Parse resource info
      const resourceData = this.parseResourceOutput(resourceOutput);
      const identityData = this.parseIdentityOutput(identityOutput);

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          ...resourceData,
          ...identityData,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to retrieve router info',
        executionTime
      );
    }
  }

  private parseResourceOutput(output: string): Record<string, unknown> {
    // Parse RouterOS resource output
    // Example output format:
    // uptime: 1d2h3m4s
    // version: 7.20 (stable)
    // cpu-load: 5%
    // free-memory: 234.5MiB
    // total-memory: 512.0MiB

    const data: Record<string, unknown> = {};

    try {
      const lines = output.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          data[key] = value;
        }
      }
    } catch (error) {
      console.error('[RouterInfoTool] Failed to parse resource output:', error);
    }

    return data;
  }

  private parseIdentityOutput(output: string): Record<string, unknown> {
    // Parse RouterOS identity output
    // Example: name: MikroTik-Router

    const data: Record<string, unknown> = {};

    try {
      const match = output.match(/name:\s*(.+)/);
      if (match) {
        data.hostname = match[1].trim();
      }
    } catch (error) {
      console.error('[RouterInfoTool] Failed to parse identity output:', error);
    }

    return data;
  }
}
