/**
 * Backup Restore Tool
 *
 * Restores router configuration from backup files.
 * Supports both script imports (.rsc) and binary backup loading (.backup).
 *
 * CRITICAL SECURITY NOTE:
 * This is a DESTRUCTIVE operation that modifies router configuration.
 * Requires explicit user confirmation before execution.
 * Can potentially break router connectivity if used incorrectly.
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class BackupRestoreTool extends BaseMCPTool {
  readonly name = 'backup_restore_config';
  readonly description =
    'DESTRUCTIVE OPERATION: Restore router configuration from a backup file. For .rsc files, imports configuration commands. For .backup files, loads complete system state. ALWAYS warn the user and ask for explicit confirmation before using this tool. May cause router reboot or connectivity loss.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description:
          'Name of the backup file to restore (e.g., "config-export.rsc" or "backup-20250130.backup")',
      },
      password: {
        type: 'string',
        description: 'Password for encrypted binary backups. Required if backup was created with encryption.',
      },
      mode: {
        type: 'string',
        description:
          'Restore mode: "import" for .rsc script import (additive), "load" for .backup binary load (replaces all)',
        enum: ['import', 'load'],
      },
      confirmed: {
        type: 'string',
        description:
          'User must explicitly type "RESTORE" to confirm this destructive operation. Case-sensitive.',
        enum: ['RESTORE'],
      },
    },
    required: ['filename', 'confirmed'],
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

      const filename = params.filename as string;
      const password = params.password as string | undefined;
      const mode = params.mode as string | undefined;
      const confirmed = params.confirmed as string;

      // CRITICAL: Require explicit confirmation
      if (confirmed !== 'RESTORE') {
        return this.error(
          'Restore operation not confirmed. User must type exactly "RESTORE" to proceed with this destructive operation.'
        );
      }

      // Validate filename (prevent path traversal)
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return this.error('Invalid filename: path traversal detected');
      }

      // Determine restore mode based on file type
      const isScriptFile = filename.endsWith('.rsc');
      const isBinaryFile = filename.endsWith('.backup');

      if (!isScriptFile && !isBinaryFile) {
        return this.error('Unsupported file type. Only .rsc and .backup files can be restored.');
      }

      // Execute appropriate restore command
      if (isScriptFile) {
        return await this.restoreScriptFile(filename, startTime);
      } else if (isBinaryFile) {
        return await this.restoreBinaryFile(filename, password, startTime);
      }

      return this.error('Unknown restore mode');
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('[BackupRestoreTool] Execution error:', error);
      return this.error(
        error instanceof Error ? error.message : 'Failed to restore configuration',
        executionTime
      );
    }
  }

  /**
   * Restore from script file (.rsc)
   * This imports configuration commands additively
   */
  private async restoreScriptFile(filename: string, startTime: number): Promise<ToolResult> {
    try {
      // Remove .rsc extension for import command
      const filenameSafe = filename.replace('.rsc', '');
      const command = `/import ${filenameSafe}`;

      console.log(`[BackupRestoreTool] Importing script file: ${filename}`);
      console.warn('[BackupRestoreTool] DESTRUCTIVE OPERATION: Importing configuration');

      // Execute import command
      const output = await mikrotikService.executeTerminalCommand(command);

      const executionTime = Date.now() - startTime;

      // Import is typically additive and doesn't require reboot
      return this.success(
        {
          filename,
          type: 'import',
          restored: true,
          rebootRequired: false,
          output,
          timestamp: new Date().toISOString(),
          message: `Successfully imported configuration from ${filename}`,
          warning: 'Configuration has been imported. Review changes carefully and test connectivity.',
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('[BackupRestoreTool] Script import error:', error);

      return this.error(
        error instanceof Error ? error.message : 'Failed to import script file',
        executionTime
      );
    }
  }

  /**
   * Restore from binary backup (.backup)
   * This replaces the entire system configuration
   */
  private async restoreBinaryFile(
    filename: string,
    password: string | undefined,
    startTime: number
  ): Promise<ToolResult> {
    try {
      // Remove .backup extension for load command
      const name = filename.replace('.backup', '');

      // Build load command
      let command = `/system backup load name=${name}`;
      if (password) {
        command += ` password=${password}`;
      }

      console.log(`[BackupRestoreTool] Loading binary backup (command logged without password)`);
      console.warn('[BackupRestoreTool] DESTRUCTIVE OPERATION: Loading binary backup - ROUTER WILL REBOOT');

      // Execute load command
      // NOTE: This will typically cause the router to reboot
      const output = await mikrotikService.executeTerminalCommand(command);

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          filename,
          type: 'load',
          restored: true,
          rebootRequired: true,
          output,
          timestamp: new Date().toISOString(),
          message: `Binary backup restore initiated. Router will reboot to apply configuration.`,
          warning:
            'CRITICAL: Router is rebooting. Connection will be lost. Wait 2-3 minutes before reconnecting.',
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('[BackupRestoreTool] Binary restore error:', error);

      // Check for common errors
      if (error instanceof Error) {
        if (error.message.includes('bad password')) {
          return this.error('Incorrect password for encrypted backup', executionTime);
        }
        if (error.message.includes('no such item')) {
          return this.error(`Backup file not found: ${filename}`, executionTime);
        }
      }

      return this.error(
        error instanceof Error ? error.message : 'Failed to load binary backup',
        executionTime
      );
    }
  }
}
