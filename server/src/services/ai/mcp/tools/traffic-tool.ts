/**
 * Traffic/Bandwidth Monitoring Tool
 *
 * Retrieves traffic and bandwidth information including:
 * - Per-IP traffic accounting
 * - Interface traffic statistics
 * - Connection tracking data
 * - Real-time bandwidth usage
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class TrafficTool extends BaseMCPTool {
  readonly name = 'get_traffic_stats';
  readonly description =
    'Get historical traffic and bandwidth statistics. Can retrieve per-IP traffic accounting data, historical bandwidth consumption, active connections, and data usage analysis. Use this when users ask about past traffic, historical bandwidth consumption, data usage by IP, or analyzing network usage patterns. DO NOT use for active speed testing or measuring current internet speed - use test_connectivity with action=internet-speed-test for that.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Type of traffic data to retrieve',
        enum: ['ip-accounting', 'interface-stats', 'connections', 'queue-stats'],
      },
      ip_address: {
        type: 'string',
        description: 'Optional: Filter by specific IP address (for ip-accounting and connections)',
      },
      interface: {
        type: 'string',
        description: 'Optional: Filter by interface name (for interface-stats)',
      },
    },
    required: ['type'],
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

      const type = params.type as string;
      const ipAddress = params.ip_address as string | undefined;
      const interfaceName = params.interface as string | undefined;

      let result: any;

      switch (type) {
        case 'ip-accounting':
          result = await this.getIPAccounting(ipAddress);
          break;
        case 'interface-stats':
          result = await this.getInterfaceStats(interfaceName);
          break;
        case 'connections':
          result = await this.getConnections(ipAddress);
          break;
        case 'queue-stats':
          result = await this.getQueueStats();
          break;
        default:
          return this.error(`Unknown traffic type: ${type}`);
      }

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          type,
          timestamp: new Date().toISOString(),
          ...result,
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to retrieve traffic statistics',
        executionTime
      );
    }
  }

  /**
   * Get IP accounting data showing traffic per IP address
   */
  private async getIPAccounting(filterIP?: string): Promise<any> {
    // Check if IP accounting is enabled
    const accountingStatus = await mikrotikService.executeTerminalCommand('/ip accounting print');

    if (accountingStatus.includes('enabled: no')) {
      return {
        enabled: false,
        error: 'IP Accounting is not enabled on the router. Enable it with: /ip accounting set enabled=yes'
      };
    }

    // Get accounting snapshot
    const command = '/ip accounting snapshot print';
    const output = await mikrotikService.executeTerminalCommand(command);
    const data = this.parseIPAccounting(output);

    if (filterIP) {
      const filtered = data.filter((entry: any) =>
        entry.src_address === filterIP || entry.dst_address === filterIP
      );
      return {
        enabled: true,
        accounting_data: filtered,
        filtered_ip: filterIP,
        total_entries: filtered.length,
      };
    }

    return {
      enabled: true,
      accounting_data: data,
      total_entries: data.length,
    };
  }

  /**
   * Get interface traffic statistics
   */
  private async getInterfaceStats(filterInterface?: string): Promise<any> {
    const command = filterInterface
      ? `/interface monitor-traffic ${filterInterface} once`
      : '/interface print stats';

    const output = await mikrotikService.executeTerminalCommand(command);
    const stats = this.parseInterfaceStats(output);

    return {
      interface_stats: stats,
      filtered_interface: filterInterface,
      count: stats.length,
    };
  }

  /**
   * Get active connection tracking data
   */
  private async getConnections(filterIP?: string): Promise<any> {
    let command = '/ip firewall connection print';
    if (filterIP) {
      command += ` where src-address~"${filterIP}" or dst-address~"${filterIP}"`;
    }

    const output = await mikrotikService.executeTerminalCommand(command);
    const connections = this.parseConnections(output);

    return {
      connections,
      filtered_ip: filterIP,
      total_connections: connections.length,
    };
  }

  /**
   * Get queue statistics for bandwidth management
   */
  private async getQueueStats(): Promise<any> {
    const simpleOutput = await mikrotikService.executeTerminalCommand('/queue simple print stats');
    const treeOutput = await mikrotikService.executeTerminalCommand('/queue tree print stats');

    return {
      simple_queues: this.parseQueueStats(simpleOutput),
      tree_queues: this.parseQueueStats(treeOutput),
    };
  }

  /**
   * Parse IP accounting snapshot output
   */
  private parseIPAccounting(output: string): Array<Record<string, unknown>> {
    const entries: Array<Record<string, unknown>> = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Format: src-address dst-address packets bytes
      const match = line.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s+(\d+)/);
      if (match) {
        entries.push({
          src_address: match[1],
          dst_address: match[2],
          packets: parseInt(match[3]),
          bytes: parseInt(match[4]),
          bytes_mb: (parseInt(match[4]) / 1024 / 1024).toFixed(2),
          bytes_gb: (parseInt(match[4]) / 1024 / 1024 / 1024).toFixed(3),
        });
      }
    }

    return entries;
  }

  /**
   * Parse interface statistics
   */
  private parseInterfaceStats(output: string): Array<Record<string, unknown>> {
    const stats: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const stat: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim().replace(/-/g, '_');
          const value = match[2].trim();
          stat[key] = value;
        }
      }

      if (Object.keys(stat).length > 0) {
        stats.push(stat);
      }
    }

    return stats;
  }

  /**
   * Parse connection tracking output
   */
  private parseConnections(output: string): Array<Record<string, unknown>> {
    const connections: Array<Record<string, unknown>> = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('protocol=') || line.includes('src-address=')) {
        const conn: Record<string, unknown> = {};

        // Parse key-value pairs
        const pairs = line.split(/\s+/);
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            conn[key.replace(/-/g, '_')] = value;
          }
        }

        if (Object.keys(conn).length > 0) {
          connections.push(conn);
        }
      }
    }

    return connections;
  }

  /**
   * Parse queue statistics
   */
  private parseQueueStats(output: string): Array<Record<string, unknown>> {
    const queues: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const queue: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim().replace(/-/g, '_');
          const value = match[2].trim();
          queue[key] = value;
        }
      }

      if (Object.keys(queue).length > 0) {
        queues.push(queue);
      }
    }

    return queues;
  }
}
