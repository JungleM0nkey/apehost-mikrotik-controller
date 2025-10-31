/**
 * Binary Backup Creation Tool
 *
 * Creates binary backup (.backup) files on the router.
 * These backups contain the complete system state including passwords.
 * Can be encrypted with a password for additional security.
 *
 * SECURITY NOTE: This is a WRITE operation that creates files on the router.
 * Use with caution and ensure proper validation.
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class BackupCreateBinaryTool extends BaseMCPTool {
  readonly name = 'backup_create_binary';
  readonly description =
    'Create a binary backup (.backup file) on the router. This creates a complete system backup including all settings, passwords, and certificates. Optionally encrypt with a password. Use this when the user wants a full system backup or binary backup.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Name for the backup file (without extension). If not provided, auto-generates based on timestamp.',
      },
      password: {
        type: 'string',
        description:
          'Optional password to encrypt the backup. Highly recommended for security. Must be remembered for restore.',
      },
      encryption: {
        type: 'string',
        description: 'Enable encryption (requires password). Options: "yes" or "no". Default is "yes" if password provided.',
        enum: ['yes', 'no'],
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

      // Generate name if not provided
      const name = (params.name as string) || this.generateBackupName();
      const password = params.password as string | undefined;
      const encryption = params.encryption as string | undefined;

      // Validate name (prevent path traversal and special characters)
      if (!this.isValidBackupName(name)) {
        return this.error(
          'Invalid backup name. Use only letters, numbers, hyphens, and underscores.'
        );
      }

      // Build backup command
      let command = `/system backup save name=${name}`;

      // Add password and encryption if provided
      if (password) {
        const useEncryption = encryption !== 'no'; // Default to yes if password provided
        command += ` password=${password}`;
        if (useEncryption) {
          command += ` encryption=yes`;
        }
      } else if (encryption === 'yes') {
        return this.error('Encryption requires a password to be provided');
      }

      console.log(`[BackupCreateBinaryTool] Executing backup creation (command logged without password)`);

      // Execute backup command
      const output = await mikrotikService.executeTerminalCommand(command);

      // The backup save command typically completes silently if successful
      // Verify by checking if the file was created
      const backupFilename = `${name}.backup`;
      const verifyCommand = `/file print where name="${backupFilename}"`;

      // Give the router a moment to create the file
      await this.sleep(1000);

      const fileInfo = await mikrotikService.executeTerminalCommand(verifyCommand);

      if (!fileInfo || !fileInfo.includes(backupFilename)) {
        return this.error(
          'Backup command executed but file was not created. Check router logs for errors.'
        );
      }

      // Parse file size if available
      const fileSize = this.parseFileSize(fileInfo);

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          filename: backupFilename,
          name,
          type: 'backup',
          encrypted: password ? true : false,
          hasPassword: password ? true : false,
          size: fileSize,
          sizeFormatted: fileSize > 0 ? this.formatBytes(fileSize) : 'Unknown',
          created: new Date().toISOString(),
          message: password
            ? `Successfully created encrypted binary backup: ${backupFilename}`
            : `Successfully created binary backup: ${backupFilename}`,
          warning: password
            ? 'Remember your password - it is required for restore!'
            : 'Backup is not encrypted. Consider using a password for sensitive data.',
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('[BackupCreateBinaryTool] Execution error:', error);
      return this.error(
        error instanceof Error ? error.message : 'Failed to create binary backup',
        executionTime
      );
    }
  }

  /**
   * Generate auto backup name with timestamp
   */
  private generateBackupName(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const time = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    return `backup-${timestamp}-${time}`;
  }

  /**
   * Validate backup name
   */
  private isValidBackupName(name: string): boolean {
    // Only allow alphanumeric, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  /**
   * Parse file size from file listing output
   */
  private parseFileSize(output: string): number {
    try {
      const sizeMatch = output.match(/size:\s*(\d+)/);
      if (sizeMatch) {
        return parseInt(sizeMatch[1], 10);
      }
    } catch (error) {
      console.error('[BackupCreateBinaryTool] Failed to parse file size:', error);
    }
    return 0;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Sleep helper for waiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
