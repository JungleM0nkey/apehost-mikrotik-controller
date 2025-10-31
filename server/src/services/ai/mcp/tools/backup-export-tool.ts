/**
 * Backup Export Tool
 *
 * Exports router configuration to .rsc (script) file format.
 * This is a read-only operation that creates a human-readable
 * script export of the router configuration.
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class BackupExportTool extends BaseMCPTool {
  readonly name = 'backup_export_config';
  readonly description =
    'Export router configuration to a .rsc script file. Creates a human-readable export of the entire configuration or specific sections (e.g., firewall, interfaces). The file is saved on the router. Set download=true to automatically download the file to the server after export. Use this when the user asks to backup, export, or save the router configuration.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description:
          'Name for the backup file (without extension). If not provided, auto-generates based on timestamp.',
      },
      section: {
        type: 'string',
        description:
          'Specific configuration section to export (e.g., "ip firewall", "interface"). Leave empty to export full configuration.',
      },
      download: {
        type: 'boolean',
        description:
          'Automatically download the backup file to the server after export. Default: false.',
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

      // Generate filename if not provided
      const filename = (params.filename as string) || this.generateFilename();
      const section = params.section as string | undefined;

      // Build export command
      let command: string;
      if (section) {
        // Export specific section
        command = `/${section} export file=${filename}`;
      } else {
        // Export full configuration
        command = `/export file=${filename}`;
      }

      console.log(`[BackupExportTool] Executing: ${command}`);

      // Execute export command
      const output = await mikrotikService.executeTerminalCommand(command);

      // Wait for export to complete (RouterOS writes files asynchronously)
      console.log('[BackupExportTool] Waiting for export to complete...');
      await this.waitForFile(filename, 10000); // Wait up to 10 seconds

      // Verify export was created by listing the file
      const fullFilename = `${filename}.rsc`;
      const fileCheckCommand = `/file print detail where name="${fullFilename}"`;
      const fileInfo = await mikrotikService.executeTerminalCommand(fileCheckCommand);

      // Parse file info to get size and details
      const fileDetails = this.parseFileInfo(fileInfo, filename);

      if (!fileDetails.found) {
        return this.error(`Export file was not created on the router. Expected: ${fullFilename}`);
      }

      if (fileDetails.size === 0) {
        return this.error('Export file was created but is empty (0 bytes). The export command may have failed.');
      }

      const executionTime = Date.now() - startTime;

      const resultData: any = {
        filename: fileDetails.name,
        size: fileDetails.size,
        sizeFormatted: this.formatBytes(fileDetails.size),
        type: 'export',
        section: section || 'full',
        created: new Date().toISOString(),
        path: fileDetails.name,
        message: section
          ? `Successfully exported ${section} configuration to ${fileDetails.name}`
          : `Successfully exported full configuration to ${fileDetails.name}`,
      };

      // Auto-download if requested
      const shouldDownload = params.download === true;
      if (shouldDownload) {
        try {
          console.log(`[BackupExportTool] Auto-downloading ${fileDetails.name}...`);

          // Import and use download tool
          const { BackupDownloadTool } = await import('./backup-download-tool.js');
          const downloadTool = new BackupDownloadTool();
          const downloadResult = await downloadTool.execute({ filename: fileDetails.name }, context);

          if (downloadResult.success && downloadResult.data) {
            resultData.downloaded = true;
            resultData.localPath = (downloadResult.data as any).localPath;
            resultData.message += ` File downloaded to server: ${(downloadResult.data as any).localPath}`;
          } else {
            resultData.downloaded = false;
            resultData.downloadError = downloadResult.error || 'Download failed';
            resultData.message += ` Warning: Auto-download failed - ${resultData.downloadError}`;
          }
        } catch (downloadError) {
          console.error('[BackupExportTool] Auto-download error:', downloadError);
          resultData.downloaded = false;
          resultData.downloadError = downloadError instanceof Error ? downloadError.message : 'Unknown error';
          resultData.message += ` Warning: Auto-download failed - ${resultData.downloadError}`;
        }
      }

      return this.success(resultData, executionTime);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('[BackupExportTool] Execution error:', error);
      return this.error(
        error instanceof Error ? error.message : 'Failed to export configuration',
        executionTime
      );
    }
  }

  /**
   * Generate auto filename with timestamp
   */
  private generateFilename(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
    return `config-export-${timestamp}`;
  }

  /**
   * Parse file listing output to extract file details
   */
  private parseFileInfo(
    output: string,
    filename: string
  ): { found: boolean; name: string; size: number; creationTime?: string } {
    const result = {
      found: false,
      name: filename + '.rsc',
      size: 0,
      creationTime: undefined as string | undefined,
    };

    try {
      const lines = output.split('\n');
      for (const line of lines) {
        // Look for name and size in output
        // Format: name: config-export.rsc type: .rsc size: 12345
        if (line.includes(filename)) {
          result.found = true;

          // Extract size
          const sizeMatch = line.match(/size:\s*(\d+)/);
          if (sizeMatch) {
            result.size = parseInt(sizeMatch[1], 10);
          }

          // Extract creation time if available
          const timeMatch = line.match(/creation-time:\s*([^\s]+\s+[^\s]+)/);
          if (timeMatch) {
            result.creationTime = timeMatch[1].trim();
          }
        }
      }
    } catch (error) {
      console.error('[BackupExportTool] Failed to parse file info:', error);
    }

    return result;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Wait for file to be created and written
   * RouterOS export operations are asynchronous
   */
  private async waitForFile(filename: string, maxWaitMs: number = 10000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 500; // Check every 500ms
    const fullFilename = `${filename}.rsc`;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const checkCommand = `/file print detail where name="${fullFilename}"`;
        const fileInfo = await mikrotikService.executeTerminalCommand(checkCommand);

        // Check if file exists and has size > 0
        const sizeMatch = fileInfo.match(/size:\s*(\d+)/);
        if (sizeMatch) {
          const size = parseInt(sizeMatch[1], 10);
          if (size > 0) {
            console.log(`[BackupExportTool] File ready: ${fullFilename} (${size} bytes)`);
            return;
          }
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('[BackupExportTool] Error polling for file:', error);
        // Continue polling despite errors
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    console.warn(`[BackupExportTool] File not ready after ${maxWaitMs}ms`);
  }
}
