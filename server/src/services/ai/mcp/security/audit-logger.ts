/**
 * Audit Logger for MCP Tool Executions
 *
 * Logs all tool calls for security auditing and debugging.
 * In production, this should write to a persistent log file or database.
 */

import type { ToolAuditEntry } from '../types.js';

export class AuditLogger {
  private logs: ToolAuditEntry[] = [];
  private readonly maxLogs: number = 1000; // Keep last 1000 logs in memory

  /**
   * Log a tool execution
   */
  log(entry: ToolAuditEntry): void {
    this.logs.push(entry);

    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console log for development
    const status = entry.result.success ? '[OK]' : '[FAILED]';
    console.log(
      `[Audit] ${status} ${entry.toolName} | Session: ${entry.sessionId.slice(0, 8)} | ` +
        `Time: ${entry.executionTime}ms | ${new Date(entry.timestamp).toISOString()}`
    );

    // Log error details if failed
    if (!entry.result.success) {
      console.error(`[Audit] Error: ${entry.result.error}`);
    }

    // TODO: In production, write to persistent storage
    // - File system (rotating logs)
    // - Database (audit table)
    // - External logging service (e.g., CloudWatch, Datadog)
  }

  /**
   * Get logs for a specific session
   */
  getSessionLogs(sessionId: string): ToolAuditEntry[] {
    return this.logs.filter((log) => log.sessionId === sessionId);
  }

  /**
   * Get logs for a specific tool
   */
  getToolLogs(toolName: string): ToolAuditEntry[] {
    return this.logs.filter((log) => log.toolName === toolName);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 50): ToolAuditEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get failed tool executions
   */
  getFailedExecutions(): ToolAuditEntry[] {
    return this.logs.filter((log) => !log.result.success);
  }

  /**
   * Clear all logs (use with caution)
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    averageExecutionTime: number;
    toolUsage: Record<string, number>;
  } {
    const successCount = this.logs.filter((log) => log.result.success).length;
    const failureCount = this.logs.length - successCount;
    const averageExecutionTime =
      this.logs.reduce((sum, log) => sum + log.executionTime, 0) / this.logs.length || 0;

    const toolUsage: Record<string, number> = {};
    for (const log of this.logs) {
      toolUsage[log.toolName] = (toolUsage[log.toolName] || 0) + 1;
    }

    return {
      totalExecutions: this.logs.length,
      successCount,
      failureCount,
      averageExecutionTime,
      toolUsage,
    };
  }
}

// Global audit logger instance
export const globalAuditLogger = new AuditLogger();
