/**
 * DHCP Leases Tool
 *
 * Retrieves DHCP lease information including:
 * - Assigned IP addresses
 * - MAC addresses
 * - Hostnames
 * - Lease status and expiry
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class DHCPTool extends BaseMCPTool {
  readonly name = 'get_dhcp_leases';
  readonly description =
    'Get DHCP lease information including assigned IP addresses, MAC addresses, hostnames, and lease status. Use this when the user asks about connected devices, DHCP assignments, or IP address allocations.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Optional filter by lease status',
        enum: ['bound', 'waiting', 'offered'],
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

      // Execute command
      const output = await mikrotikService.executeTerminalCommand('/ip dhcp-server lease print');
      const leases = this.parseDHCPOutput(output);

      // Apply status filter if provided
      const statusFilter = params.status as string | undefined;
      const filteredLeases = statusFilter
        ? leases.filter((lease) => lease.status === statusFilter)
        : leases;

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          leases: filteredLeases,
          count: filteredLeases.length,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to retrieve DHCP leases',
        executionTime
      );
    }
  }

  private parseDHCPOutput(output: string): Array<Record<string, unknown>> {
    const leases: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const leaseData: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          leaseData[key] = value;
        }
      }

      if (Object.keys(leaseData).length > 0) {
        leases.push(leaseData);
      }
    }

    return leases;
  }
}
