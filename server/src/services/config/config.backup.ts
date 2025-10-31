/**
 * Configuration Backup Manager
 *
 * Handles backup and restore operations for configuration files
 * Supports:
 * - Automatic backups before changes
 * - Manual backup creation
 * - Point-in-time restore
 * - Backup rotation and cleanup
 * - Backup verification and integrity checks
 */

import fs from 'fs/promises';
import path from 'path';
import { validateConfig } from './config.validator.js';

interface BackupMetadata {
  timestamp: string;
  version: string;
  source: 'config.json' | '.env' | 'migration';
  description?: string;
  createdBy: 'auto' | 'manual' | 'migration';
}

interface BackupInfo {
  id: string;
  path: string;
  metadata: BackupMetadata;
  size: number;
  created: Date;
}

interface RestoreOptions {
  verify?: boolean;
  createBackup?: boolean;
}

interface BackupOptions {
  description?: string;
  createdBy?: 'auto' | 'manual' | 'migration';
}

export class ConfigBackup {
  private backupDir: string;
  private configPath: string;
  private maxBackups: number;

  constructor(
    rootDir: string = process.cwd(),
    maxBackups: number = 10
  ) {
    this.backupDir = path.join(rootDir, '.config-backups');
    this.configPath = path.join(rootDir, 'config.json');
    this.maxBackups = maxBackups;
  }

  /**
   * Create a backup of the current configuration
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupInfo> {
    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });

    // Generate backup ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `config-${timestamp}`;
    const backupPath = path.join(this.backupDir, `${backupId}.json`);
    const metadataPath = path.join(this.backupDir, `${backupId}.meta.json`);

    try {
      // Read current configuration
      const content = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(content);

      // Create metadata
      const metadata: BackupMetadata = {
        timestamp: new Date().toISOString(),
        version: config.version || '1.0.0',
        source: 'config.json',
        description: options.description,
        createdBy: options.createdBy || 'manual',
      };

      // Write backup file
      await fs.writeFile(backupPath, content, { encoding: 'utf8', mode: 0o600 });

      // Write metadata file
      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        { encoding: 'utf8', mode: 0o600 }
      );

      // Get file stats
      const stats = await fs.stat(backupPath);

      // Clean up old backups
      await this.rotateBackups();

      return {
        id: backupId,
        path: backupPath,
        metadata,
        size: stats.size,
        created: new Date(metadata.timestamp),
      };
    } catch (error: any) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      await fs.access(this.backupDir);
    } catch {
      return [];
    }

    const files = await fs.readdir(this.backupDir);
    const backupFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.meta.json'));

    const backups: BackupInfo[] = [];

    for (const file of backupFiles) {
      const backupId = file.replace('.json', '');
      const backupPath = path.join(this.backupDir, file);
      const metadataPath = path.join(this.backupDir, `${backupId}.meta.json`);

      try {
        // Read metadata
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        const metadata: BackupMetadata = JSON.parse(metadataContent);

        // Get file stats
        const stats = await fs.stat(backupPath);

        backups.push({
          id: backupId,
          path: backupPath,
          metadata,
          size: stats.size,
          created: new Date(metadata.timestamp),
        });
      } catch (error) {
        // Skip invalid backups
        continue;
      }
    }

    // Sort by creation date (newest first)
    backups.sort((a, b) => b.created.getTime() - a.created.getTime());

    return backups;
  }

  /**
   * Get information about a specific backup
   */
  async getBackup(backupId: string): Promise<BackupInfo | null> {
    const backups = await this.listBackups();
    return backups.find(b => b.id === backupId) || null;
  }

  /**
   * Restore configuration from a backup
   */
  async restoreBackup(
    backupId: string,
    options: RestoreOptions = {}
  ): Promise<void> {
    const backup = await this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Read backup content
    const content = await fs.readFile(backup.path, 'utf8');

    // Verify configuration if requested
    if (options.verify !== false) {
      try {
        const config = JSON.parse(content);
        const validation = validateConfig(config);
        if (!validation.valid) {
          throw new Error(
            `Backup configuration is invalid: ${validation.errors.join(', ')}`
          );
        }
      } catch (error: any) {
        throw new Error(`Backup verification failed: ${error.message}`);
      }
    }

    // Create backup of current config before restore
    if (options.createBackup !== false) {
      try {
        await this.createBackup({
          description: `Auto-backup before restore of ${backupId}`,
          createdBy: 'auto',
        });
      } catch (error: any) {
        throw new Error(
          `Failed to backup current config before restore: ${error.message}`
        );
      }
    }

    // Restore configuration
    try {
      await fs.writeFile(this.configPath, content, {
        encoding: 'utf8',
        mode: 0o600,
      });
    } catch (error: any) {
      throw new Error(`Failed to restore configuration: ${error.message}`);
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, `${backupId}.json`);
    const metadataPath = path.join(this.backupDir, `${backupId}.meta.json`);

    try {
      await fs.unlink(backupPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to delete backup file: ${error.message}`);
      }
    }

    try {
      await fs.unlink(metadataPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to delete metadata file: ${error.message}`);
      }
    }
  }

  /**
   * Clean up old backups, keeping only the most recent N backups
   */
  async rotateBackups(): Promise<number> {
    const backups = await this.listBackups();

    if (backups.length <= this.maxBackups) {
      return 0;
    }

    // Delete old backups (keep only maxBackups)
    const toDelete = backups.slice(this.maxBackups);
    let deleted = 0;

    for (const backup of toDelete) {
      try {
        await this.deleteBackup(backup.id);
        deleted++;
      } catch (error) {
        // Continue deleting other backups even if one fails
        continue;
      }
    }

    return deleted;
  }

  /**
   * Delete all backups
   */
  async deleteAllBackups(): Promise<number> {
    const backups = await this.listBackups();
    let deleted = 0;

    for (const backup of backups) {
      try {
        await this.deleteBackup(backup.id);
        deleted++;
      } catch (error) {
        continue;
      }
    }

    return deleted;
  }

  /**
   * Verify integrity of a backup
   */
  async verifyBackup(backupId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const backup = await this.getBackup(backupId);
    if (!backup) {
      return {
        valid: false,
        errors: [`Backup not found: ${backupId}`],
      };
    }

    const errors: string[] = [];

    try {
      // Read and parse backup
      const content = await fs.readFile(backup.path, 'utf8');
      const config = JSON.parse(content);

      // Validate configuration
      const validation = validateConfig(config);
      if (!validation.valid) {
        errors.push(...validation.errors);
      }

      // Check metadata integrity
      const metadataPath = path.join(
        this.backupDir,
        `${backupId}.meta.json`
      );
      try {
        await fs.access(metadataPath);
      } catch {
        errors.push('Metadata file missing');
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Verification failed: ${error.message}`],
      };
    }
  }

  /**
   * Get backup statistics
   */
  async getStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    const backups = await this.listBackups();

    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const oldestBackup = backups.length > 0 ? backups[backups.length - 1].created : null;
    const newestBackup = backups.length > 0 ? backups[0].created : null;

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup,
      newestBackup,
    };
  }

  /**
   * Export a backup to a specific location
   */
  async exportBackup(backupId: string, exportPath: string): Promise<void> {
    const backup = await this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Read backup content
    const content = await fs.readFile(backup.path, 'utf8');

    // Write to export location
    await fs.writeFile(exportPath, content, {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  /**
   * Import a backup from an external location
   */
  async importBackup(
    importPath: string,
    description?: string
  ): Promise<BackupInfo> {
    // Read and validate imported config
    const content = await fs.readFile(importPath, 'utf8');
    const config = JSON.parse(content);

    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new Error(
        `Imported configuration is invalid: ${validation.errors.join(', ')}`
      );
    }

    // Create backup from imported config
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `config-imported-${timestamp}`;
    const backupPath = path.join(this.backupDir, `${backupId}.json`);
    const metadataPath = path.join(this.backupDir, `${backupId}.meta.json`);

    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });

    // Create metadata
    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      version: config.version || '1.0.0',
      source: 'config.json',
      description: description || 'Imported configuration',
      createdBy: 'manual',
    };

    // Write backup
    await fs.writeFile(backupPath, content, { encoding: 'utf8', mode: 0o600 });
    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      { encoding: 'utf8', mode: 0o600 }
    );

    // Get file stats
    const stats = await fs.stat(backupPath);

    return {
      id: backupId,
      path: backupPath,
      metadata,
      size: stats.size,
      created: new Date(metadata.timestamp),
    };
  }
}
