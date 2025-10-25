/**
 * Safe Command Tool
 *
 * Executes whitelisted RouterOS commands safely.
 * This is the most security-critical tool - it allows command execution
 * but ONLY for commands that pass strict whitelist validation.
 *
 * Security measures:
 * - Whitelist validation (only safe read-only commands)
 * - No write operations allowed
 * - No user management
 * - No system control (reboot/shutdown)
 * - Audit logging of all executions
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';
import { globalCommandWhitelist } from '../security/command-whitelist.js';

export class SafeCommandTool extends BaseMCPTool {
  readonly name = 'execute_safe_command';
  readonly description =
    'Execute a safe, whitelisted RouterOS command. Only read-only commands are allowed (print, show commands). Use this for commands not covered by other specialized tools. Examples: /log print, /system package print, /tool ping.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The RouterOS command to execute. Must be from the whitelist of safe commands.',
      },
    },
    required: ['command'],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate input
      const validation = this.validateInput(params);
      if (!validation.valid) {
        return this.error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      const command = params.command as string;

      // Validate command against whitelist - CRITICAL SECURITY CHECK
      const whitelistResult = globalCommandWhitelist.validate(command);
      if (!whitelistResult.safe) {
        console.warn(`[SafeCommandTool] Blocked unsafe command: ${command}`);
        return this.error(
          `Command not allowed: ${whitelistResult.reason}. Only whitelisted read-only commands are permitted.`
        );
      }

      if (!mikrotikService) {
        return this.error('MikroTik service not available');
      }

      console.log(`[SafeCommandTool] Executing whitelisted command: ${command}`);

      // Execute the command
      const output = await mikrotikService.executeTerminalCommand(command);

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          command,
          output,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[SafeCommandTool] Command execution failed:`, error);
      return this.error(
        error instanceof Error ? error.message : 'Failed to execute command',
        executionTime
      );
    }
  }
}
