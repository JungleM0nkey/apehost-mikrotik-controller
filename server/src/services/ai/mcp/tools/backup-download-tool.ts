/**
 * Backup Download Tool
 *
 * Downloads backup files from the router to the dashboard server.
 * Uses file content retrieval via RouterOS API.
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';
import fs from 'fs/promises';
import path from 'path';

export class BackupDownloadTool extends BaseMCPTool {
  readonly name = 'backup_download_file';
  readonly description =
    'Download a backup file from the router to the dashboard server. The file is saved in the server backup directory for safekeeping. Use this when the user wants to save, download, or retrieve a backup file locally.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Name of the file to download from the router (e.g., "config-export.rsc")',
      },
      localName: {
        type: 'string',
        description:
          'Optional custom name for the downloaded file. If not provided, uses the original filename.',
      },
    },
    required: ['filename'],
  };

  private readonly backupDir = path.join(process.cwd(), 'server', 'data', 'backups');

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
      const localName = (params.localName as string) || filename;

      // Validate filename (prevent path traversal)
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return this.error('Invalid filename: path traversal detected');
      }

      // Ensure backup directory exists
      await this.ensureBackupDirectory();

      // For .rsc files (script exports), we can read content directly
      if (filename.endsWith('.rsc')) {
        return await this.downloadScriptFile(filename, localName, startTime);
      }

      // For binary .backup files, we need FTP/file transfer
      // For now, return a message that binary backup download requires FTP setup
      if (filename.endsWith('.backup')) {
        return this.error(
          'Binary backup download requires FTP service configuration. Please use script exports (.rsc) or set up FTP access.'
        );
      }

      return this.error('Unsupported file type. Only .rsc and .backup files are supported.');
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('[BackupDownloadTool] Execution error:', error);
      return this.error(
        error instanceof Error ? error.message : 'Failed to download backup file',
        executionTime
      );
    }
  }

  /**
   * Download script export file (.rsc)
   * These can be retrieved as text via file contents command
   */
  private async downloadScriptFile(
    filename: string,
    localName: string,
    startTime: number
  ): Promise<ToolResult> {
    try {
      // Get file content using /file/get
      // Note: This works for text files like .rsc exports
      const filenameSafe = filename.replace('.rsc', '');
      const command = `/file get ${filenameSafe} contents`;

      console.log(`[BackupDownloadTool] Reading file: ${command}`);

      const content = await mikrotikService.executeTerminalCommand(command);

      if (!content || content.trim().length === 0) {
        return this.error('File content is empty or file does not exist');
      }

      // Save to local filesystem
      const localPath = path.join(this.backupDir, localName);
      await fs.writeFile(localPath, content, { encoding: 'utf-8', mode: 0o600 });

      // Get file stats
      const stats = await fs.stat(localPath);

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          filename: localName,
          originalFilename: filename,
          localPath,
          size: stats.size,
          sizeFormatted: this.formatBytes(stats.size),
          type: 'export',
          downloaded: new Date().toISOString(),
          message: `Successfully downloaded ${filename} to server (${this.formatBytes(stats.size)})`,
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('[BackupDownloadTool] Script file download error:', error);

      // Check if it's a file not found error
      if (error instanceof Error && error.message.includes('no such item')) {
        return this.error(`File not found on router: ${filename}`, executionTime);
      }

      return this.error(
        error instanceof Error ? error.message : 'Failed to download script file',
        executionTime
      );
    }
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.backupDir, { recursive: true, mode: 0o700 });
      console.log(`[BackupDownloadTool] Created backup directory: ${this.backupDir}`);
    }
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
}
