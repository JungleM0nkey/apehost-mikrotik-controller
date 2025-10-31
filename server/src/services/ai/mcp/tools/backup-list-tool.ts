/**
 * Backup List Tool
 *
 * Lists all backup files on the MikroTik router.
 * Shows both binary backups (.backup) and script exports (.rsc).
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

interface BackupFile {
  name: string;
  size: number;
  sizeFormatted: string;
  type: 'backup' | 'export' | 'other';
  creationTime?: string;
}

export class BackupListTool extends BaseMCPTool {
  readonly name = 'backup_list_files';
  readonly description =
    'List all backup files on the router including binary backups (.backup) and script exports (.rsc). Shows file name, size, type, and creation time. Use this when the user asks to see, list, or show available backups.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Filter by file type: "backup" for binary backups, "export" for .rsc files, "all" for both',
        enum: ['backup', 'export', 'all'],
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

      const filterType = (params.type as string) || 'all';

      // Build file listing command with filters
      let command = '/file print detail';

      // Add type filter if specified
      if (filterType === 'backup') {
        command += ' where name~".backup"';
      } else if (filterType === 'export') {
        command += ' where name~".rsc"';
      } else {
        // Show both backup and export files
        command += ' where (name~".backup" or name~".rsc")';
      }

      console.log(`[BackupListTool] Executing: ${command}`);

      // Execute command
      const output = await mikrotikService.executeTerminalCommand(command);

      // Parse file listing
      const files = this.parseFileList(output);

      // Sort by creation time (newest first) if available, otherwise by name
      files.sort((a, b) => {
        if (a.creationTime && b.creationTime) {
          return b.creationTime.localeCompare(a.creationTime);
        }
        return b.name.localeCompare(a.name);
      });

      const executionTime = Date.now() - startTime;

      // Calculate total size
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      return this.success(
        {
          files,
          count: files.length,
          totalSize,
          totalSizeFormatted: this.formatBytes(totalSize),
          filter: filterType,
          message: `Found ${files.length} backup file${files.length === 1 ? '' : 's'}`,
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('[BackupListTool] Execution error:', error);
      return this.error(
        error instanceof Error ? error.message : 'Failed to list backup files',
        executionTime
      );
    }
  }

  /**
   * Parse file listing output
   * Format is typically multi-line with properties like:
   * name: config-export.rsc
   * type: .rsc file
   * size: 12345
   * creation-time: jan/30/2025 12:00:00
   */
  private parseFileList(output: string): BackupFile[] {
    const files: BackupFile[] = [];
    const lines = output.split('\n');

    let currentFile: Partial<BackupFile> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Empty line signals end of file entry
      if (!trimmedLine) {
        if (currentFile.name) {
          files.push(this.completeFileEntry(currentFile));
          currentFile = {};
        }
        continue;
      }

      // Parse key-value pairs
      const match = trimmedLine.match(/^([^:]+):\s*(.+)$/);
      if (!match) continue;

      const key = match[1].trim();
      const value = match[2].trim();

      switch (key) {
        case 'name':
          currentFile.name = value;
          break;
        case 'size':
          currentFile.size = parseInt(value, 10) || 0;
          break;
        case 'creation-time':
          currentFile.creationTime = value;
          break;
      }
    }

    // Add last file if exists
    if (currentFile.name) {
      files.push(this.completeFileEntry(currentFile));
    }

    return files;
  }

  /**
   * Complete file entry with derived fields
   */
  private completeFileEntry(partial: Partial<BackupFile>): BackupFile {
    const name = partial.name || 'unknown';
    const size = partial.size || 0;

    return {
      name,
      size,
      sizeFormatted: this.formatBytes(size),
      type: this.getFileType(name),
      creationTime: partial.creationTime,
    };
  }

  /**
   * Determine file type from extension
   */
  private getFileType(filename: string): 'backup' | 'export' | 'other' {
    if (filename.endsWith('.backup')) {
      return 'backup';
    } else if (filename.endsWith('.rsc')) {
      return 'export';
    }
    return 'other';
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
