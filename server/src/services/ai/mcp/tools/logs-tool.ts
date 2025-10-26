/**
 * System Logs and Monitoring Tool
 *
 * Retrieves system logs and monitoring information including:
 * - System logs with filtering
 * - Error and warning logs
 * - Critical events
 * - Log statistics
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class LogsTool extends BaseMCPTool {
  readonly name = 'get_logs';
  readonly description =
    'Get system logs and event information. Can filter by log level (info, warning, error, critical), topic (system, firewall, wireless, etc.), or time range. Use this when users ask about errors, events, system activity, or want to troubleshoot issues.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional: Filter logs by topic (system, firewall, wireless, interface, dhcp, account, etc.)',
      },
      level: {
        type: 'string',
        description: 'Optional: Filter by log level',
        enum: ['info', 'warning', 'error', 'critical'],
      },
      limit: {
        type: 'number',
        description: 'Optional: Maximum number of log entries to return (default: 50, max: 200)',
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

      const filter = params.filter as string | undefined;
      const level = params.level as string | undefined;
      const limit = Math.min((params.limit as number) || 50, 200);

      // Build command
      let command = '/log print';

      // Add filters
      const whereConditions: string[] = [];

      if (filter) {
        whereConditions.push(`topics~"${filter}"`);
      }

      if (level) {
        // Map level to RouterOS log levels
        const levelMap: Record<string, string> = {
          'info': 'info',
          'warning': 'warning',
          'error': 'error',
          'critical': 'critical',
        };
        const rosLevel = levelMap[level];
        if (rosLevel) {
          whereConditions.push(`message~"${rosLevel}"`);
        }
      }

      if (whereConditions.length > 0) {
        command += ` where ${whereConditions.join(' and ')}`;
      }

      // Execute command
      const output = await mikrotikService.executeTerminalCommand(command);
      const logs = this.parseLogs(output, limit);

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          logs,
          total_returned: logs.length,
          filter_applied: filter,
          level_filter: level,
          limit,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to retrieve logs',
        executionTime
      );
    }
  }

  /**
   * Parse log output
   */
  private parseLogs(output: string, limit: number): Array<Record<string, unknown>> {
    const logs: Array<Record<string, unknown>> = [];
    const lines = output.split('\n');

    let currentLog: Record<string, unknown> | null = null;

    for (const line of lines) {
      // Check if this is a new log entry (starts with timestamp or number)
      const newEntryMatch = line.match(/^\s*(\d+)\s+(.+)$/);

      if (newEntryMatch) {
        // Save previous log if exists
        if (currentLog && Object.keys(currentLog).length > 0) {
          logs.push(currentLog);
          if (logs.length >= limit) break;
        }

        // Start new log entry
        currentLog = {
          index: newEntryMatch[1],
        };

        // Parse the rest of the line
        const rest = newEntryMatch[2];
        this.parseLogLine(rest, currentLog);
      } else if (currentLog && line.trim()) {
        // Continuation of previous log entry
        this.parseLogLine(line.trim(), currentLog);
      }
    }

    // Add last log if exists
    if (currentLog && Object.keys(currentLog).length > 0 && logs.length < limit) {
      logs.push(currentLog);
    }

    return logs;
  }

  /**
   * Parse a single log line into the log object
   */
  private parseLogLine(line: string, log: Record<string, unknown>): void {
    // Try to extract key-value pairs
    const pairs = line.split(/\s+/);

    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex > 0) {
        const key = pair.substring(0, eqIndex).replace(/-/g, '_');
        const value = pair.substring(eqIndex + 1);
        log[key] = value;
      }
    }

    // If no key-value pairs found, this might be the message
    if (!line.includes('=') && line.length > 0) {
      if (log.message) {
        log.message += ' ' + line;
      } else {
        log.message = line;
      }
    }
  }
}
