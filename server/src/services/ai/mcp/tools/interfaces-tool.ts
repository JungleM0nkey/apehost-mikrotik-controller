/**
 * Interfaces Tool
 *
 * Retrieves information about network interfaces including:
 * - Interface names and types
 * - Status (up/down)
 * - Traffic statistics (RX/TX rates and bytes)
 * - MAC addresses
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class InterfacesTool extends BaseMCPTool {
  readonly name = 'get_interfaces';
  readonly description =
    'Get information about network interfaces including their status, type, and current traffic rates (RX/TX). Use this when the user asks about interface status, current bandwidth usage monitoring, or interface types. DO NOT use for active speed testing or internet speed measurements - use test_connectivity tool with action=internet-speed-test for that.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Optional filter by interface type (ethernet, wireless, bridge, vlan)',
        enum: ['ethernet', 'wireless', 'bridge', 'vlan', 'bonding'],
      },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate input
      const validation = this.validateInput(params);
      if (!validation.valid) {
        return this.error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      if (!mikrotikService) {
        return this.error('MikroTik service not available');
      }

      const typeFilter = params.type as string | undefined;

      // Execute command to get interfaces
      let command = '/interface print detail';
      if (typeFilter) {
        command = `/interface ${typeFilter} print detail`;
      }

      const output = await mikrotikService.executeTerminalCommand(command);
      const interfaces = this.parseInterfaceOutput(output);

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          interfaces,
          count: interfaces.length,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to retrieve interfaces',
        executionTime
      );
    }
  }

  private parseInterfaceOutput(output: string): Array<Record<string, unknown>> {
    // Parse RouterOS interface output
    // Format is typically multi-line with interface blocks

    const interfaces: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/); // Split by empty lines

    for (const block of blocks) {
      if (!block.trim()) continue;

      const interfaceData: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          interfaceData[key] = value;
        }
      }

      if (Object.keys(interfaceData).length > 0) {
        interfaces.push(interfaceData);
      }
    }

    return interfaces;
  }
}
