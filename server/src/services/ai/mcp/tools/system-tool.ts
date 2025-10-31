/**
 * System Resources and Monitoring Tool
 *
 * Retrieves system resource information including:
 * - CPU usage and load
 * - Memory usage
 * - Disk usage
 * - System health
 * - Temperature sensors
 * - Uptime and version info
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class SystemTool extends BaseMCPTool {
  readonly name = 'get_system_resources';
  readonly description =
    'Get system resource information including CPU usage, memory, disk space, temperature, uptime, health sensors, hardware status, RouterOS version, and router identity. Use this when users ask about CPU/memory metrics, resource monitoring, disk usage, system temperature, hardware health, RouterOS version, or router hostname. DO NOT use for network connectivity testing, internet speed tests, or bandwidth measurements.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Type of system information to retrieve',
        enum: ['resources', 'health', 'history', 'identity'],
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
      let result: any;

      switch (type) {
        case 'resources':
          result = await this.getResources();
          break;
        case 'health':
          result = await this.getHealth();
          break;
        case 'history':
          result = await this.getHistory();
          break;
        case 'identity':
          result = await this.getIdentity();
          break;
        default:
          return this.error(`Unknown system type: ${type}`);
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
        error instanceof Error ? error.message : 'Failed to retrieve system information',
        executionTime
      );
    }
  }

  /**
   * Get current system resources
   */
  private async getResources(): Promise<any> {
    const output = await mikrotikService.executeTerminalCommand('/system resource print');
    const resources = this.parseResources(output);

    return {
      resources,
    };
  }

  /**
   * Get system health (temperature, voltage, etc.)
   */
  private async getHealth(): Promise<any> {
    try {
      const output = await mikrotikService.executeTerminalCommand('/system health print');
      const health = this.parseHealth(output);

      return {
        health,
        health_available: true,
      };
    } catch (error) {
      return {
        health_available: false,
        message: 'Health monitoring not supported on this device',
      };
    }
  }

  /**
   * Get resource usage history
   */
  private async getHistory(): Promise<any> {
    try {
      const output = await mikrotikService.executeTerminalCommand('/system resource monitor once');
      const history = this.parseHistory(output);

      return {
        history,
        history_available: true,
      };
    } catch (error) {
      return {
        history_available: false,
        message: 'Resource history not available',
      };
    }
  }

  /**
   * Get system identity and basic info
   * Phase 3: Enhanced to include RouterOS version, board-name, and architecture
   */
  private async getIdentity(): Promise<any> {
    const [identityOutput, clockOutput, resourceOutput] = await Promise.all([
      mikrotikService.executeTerminalCommand('/system identity print'),
      mikrotikService.executeTerminalCommand('/system clock print'),
      mikrotikService.executeTerminalCommand('/system resource print'),
    ]);

    const resources = this.parseResources(resourceOutput);

    return {
      identity: this.parseSimpleOutput(identityOutput),
      clock: this.parseSimpleOutput(clockOutput),
      version: resources.version,
      board_name: resources.board_name,
      architecture: resources.architecture,
    };
  }

  /**
   * Parse system resources output
   */
  private parseResources(output: string): Record<string, unknown> {
    const resources: Record<string, unknown> = {};
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().replace(/-/g, '_').replace(/\s+/g, '_');
        const value = match[2].trim();
        resources[key] = value;

        // Parse specific fields for better formatting
        if (key === 'total_memory') {
          const mb = parseInt(value) / 1024 / 1024;
          resources['total_memory_mb'] = mb.toFixed(0);
        } else if (key === 'free_memory') {
          const mb = parseInt(value) / 1024 / 1024;
          resources['free_memory_mb'] = mb.toFixed(0);
        } else if (key === 'total_hdd_space') {
          const mb = parseInt(value) / 1024 / 1024;
          resources['total_hdd_space_mb'] = mb.toFixed(0);
        } else if (key === 'free_hdd_space') {
          const mb = parseInt(value) / 1024 / 1024;
          resources['free_hdd_space_mb'] = mb.toFixed(0);
        }
      }
    }

    return resources;
  }

  /**
   * Parse system health output
   */
  private parseHealth(output: string): Record<string, unknown> {
    const health: Record<string, unknown> = {};
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().replace(/-/g, '_').replace(/\s+/g, '_');
        const value = match[2].trim();
        health[key] = value;
      }
    }

    return health;
  }

  /**
   * Parse resource history/monitor output
   */
  private parseHistory(output: string): Record<string, unknown> {
    const history: Record<string, unknown> = {};
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().replace(/-/g, '_').replace(/\s+/g, '_');
        const value = match[2].trim();
        history[key] = value;
      }
    }

    return history;
  }

  /**
   * Parse simple key-value output
   */
  private parseSimpleOutput(output: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().replace(/-/g, '_').replace(/\s+/g, '_');
        const value = match[2].trim();
        result[key] = value;
      }
    }

    return result;
  }
}
