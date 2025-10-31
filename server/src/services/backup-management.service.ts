/**
 * Backup Management Service
 *
 * Manages router backup metadata, schedules, and retention policies.
 * Orchestrates backup operations using MCP tools and maintains local backup storage.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================
// Type Definitions
// =====================

export interface BackupMetadata {
  id: string;
  filename: string;
  type: 'export' | 'binary';
  timestamp: string;
  size: number;
  encrypted: boolean;
  routerVersion?: string;
  routerHostname?: string;
  source: 'manual' | 'scheduled';
  scheduleId?: string;
  localPath: string;
  remoteStatus?: {
    exists: boolean;
    lastVerified: string;
  };
}

export interface BackupSchedule {
  id: string;
  name: string;
  type: 'export' | 'binary';
  cron: string;
  enabled: boolean;
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  password?: string; // For encrypted binary backups
  lastRun?: string;
  nextRun?: string;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
}

export interface BackupFilter {
  type?: 'export' | 'binary';
  source?: 'manual' | 'scheduled';
  encrypted?: boolean;
  startDate?: string;
  endDate?: string;
}

interface BackupDatabase {
  backups: BackupMetadata[];
  schedules: BackupSchedule[];
  version: string;
  lastUpdated: string;
}

// =====================
// Service Class
// =====================

export class BackupManagementService {
  private static instance: BackupManagementService | null = null;

  private readonly backupsDir: string;
  private readonly metadataFile: string;
  private database: BackupDatabase | null = null;

  private constructor() {
    // Backup storage directory
    this.backupsDir = path.resolve(__dirname, '../../data/backups');
    this.metadataFile = path.join(this.backupsDir, 'metadata.json');
  }

  public static getInstance(): BackupManagementService {
    if (!BackupManagementService.instance) {
      BackupManagementService.instance = new BackupManagementService();
    }
    return BackupManagementService.instance;
  }

  /**
   * Initialize service - ensure directories exist and load metadata
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupsDir, { recursive: true, mode: 0o700 });

      // Load or create metadata
      await this.loadMetadata();

      console.log('[BackupManagement] Service initialized');
    } catch (error) {
      console.error('[BackupManagement] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load metadata from file or create new database
   */
  private async loadMetadata(): Promise<void> {
    try {
      const exists = await this.fileExists(this.metadataFile);

      if (exists) {
        const content = await fs.readFile(this.metadataFile, 'utf-8');
        this.database = JSON.parse(content);
        console.log('[BackupManagement] Metadata loaded:', {
          backups: this.database?.backups.length,
          schedules: this.database?.schedules.length,
        });
      } else {
        // Create new database
        this.database = {
          backups: [],
          schedules: [],
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
        };
        await this.saveMetadata();
        console.log('[BackupManagement] New metadata database created');
      }
    } catch (error) {
      console.error('[BackupManagement] Failed to load metadata:', error);
      throw error;
    }
  }

  /**
   * Save metadata to file
   */
  private async saveMetadata(): Promise<void> {
    try {
      if (!this.database) {
        throw new Error('Database not initialized');
      }

      this.database.lastUpdated = new Date().toISOString();

      const content = JSON.stringify(this.database, null, 2);
      const tempFile = `${this.metadataFile}.tmp`;

      // Atomic write
      await fs.writeFile(tempFile, content, { encoding: 'utf-8', mode: 0o600 });
      await fs.rename(tempFile, this.metadataFile);

      console.log('[BackupManagement] Metadata saved');
    } catch (error) {
      console.error('[BackupManagement] Failed to save metadata:', error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // =====================
  // Backup Operations
  // =====================

  /**
   * Register a new backup in metadata
   */
  public async registerBackup(metadata: Omit<BackupMetadata, 'id'>): Promise<BackupMetadata> {
    if (!this.database) {
      await this.initialize();
    }

    const backup: BackupMetadata = {
      id: uuidv4(),
      ...metadata,
    };

    this.database!.backups.push(backup);
    await this.saveMetadata();

    console.log('[BackupManagement] Backup registered:', backup.id);
    return backup;
  }

  /**
   * List all backups with optional filtering
   */
  public async listBackups(filter?: BackupFilter): Promise<BackupMetadata[]> {
    if (!this.database) {
      await this.initialize();
    }

    let backups = [...this.database!.backups];

    // Apply filters
    if (filter) {
      if (filter.type) {
        backups = backups.filter(b => b.type === filter.type);
      }
      if (filter.source) {
        backups = backups.filter(b => b.source === filter.source);
      }
      if (filter.encrypted !== undefined) {
        backups = backups.filter(b => b.encrypted === filter.encrypted);
      }
      if (filter.startDate) {
        backups = backups.filter(b => b.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        backups = backups.filter(b => b.timestamp <= filter.endDate!);
      }
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return backups;
  }

  /**
   * Get specific backup by ID
   */
  public async getBackup(id: string): Promise<BackupMetadata | null> {
    if (!this.database) {
      await this.initialize();
    }

    const backup = this.database!.backups.find(b => b.id === id);
    return backup || null;
  }

  /**
   * Update backup metadata
   */
  public async updateBackup(id: string, updates: Partial<BackupMetadata>): Promise<boolean> {
    if (!this.database) {
      await this.initialize();
    }

    const index = this.database!.backups.findIndex(b => b.id === id);
    if (index === -1) {
      return false;
    }

    this.database!.backups[index] = {
      ...this.database!.backups[index],
      ...updates,
      id, // Ensure ID doesn't change
    };

    await this.saveMetadata();
    console.log('[BackupManagement] Backup updated:', id);
    return true;
  }

  /**
   * Delete backup from metadata and filesystem
   */
  public async deleteBackup(id: string): Promise<boolean> {
    if (!this.database) {
      await this.initialize();
    }

    const backup = this.database!.backups.find(b => b.id === id);
    if (!backup) {
      return false;
    }

    // Delete from filesystem
    try {
      if (await this.fileExists(backup.localPath)) {
        await fs.unlink(backup.localPath);
        console.log('[BackupManagement] Backup file deleted:', backup.localPath);
      }
    } catch (error) {
      console.error('[BackupManagement] Failed to delete backup file:', error);
    }

    // Remove from database
    this.database!.backups = this.database!.backups.filter(b => b.id !== id);
    await this.saveMetadata();

    console.log('[BackupManagement] Backup deleted:', id);
    return true;
  }

  // =====================
  // Schedule Operations
  // =====================

  /**
   * Create a new backup schedule
   */
  public async createSchedule(schedule: Omit<BackupSchedule, 'id'>): Promise<BackupSchedule> {
    if (!this.database) {
      await this.initialize();
    }

    const newSchedule: BackupSchedule = {
      id: uuidv4(),
      ...schedule,
    };

    this.database!.schedules.push(newSchedule);
    await this.saveMetadata();

    console.log('[BackupManagement] Schedule created:', newSchedule.id);
    return newSchedule;
  }

  /**
   * List all schedules
   */
  public async listSchedules(): Promise<BackupSchedule[]> {
    if (!this.database) {
      await this.initialize();
    }

    return [...this.database!.schedules];
  }

  /**
   * Get specific schedule by ID
   */
  public async getSchedule(id: string): Promise<BackupSchedule | null> {
    if (!this.database) {
      await this.initialize();
    }

    const schedule = this.database!.schedules.find(s => s.id === id);
    return schedule || null;
  }

  /**
   * Update schedule
   */
  public async updateSchedule(id: string, updates: Partial<BackupSchedule>): Promise<boolean> {
    if (!this.database) {
      await this.initialize();
    }

    const index = this.database!.schedules.findIndex(s => s.id === id);
    if (index === -1) {
      return false;
    }

    this.database!.schedules[index] = {
      ...this.database!.schedules[index],
      ...updates,
      id, // Ensure ID doesn't change
    };

    await this.saveMetadata();
    console.log('[BackupManagement] Schedule updated:', id);
    return true;
  }

  /**
   * Delete schedule
   */
  public async deleteSchedule(id: string): Promise<boolean> {
    if (!this.database) {
      await this.initialize();
    }

    const initialLength = this.database!.schedules.length;
    this.database!.schedules = this.database!.schedules.filter(s => s.id !== id);

    if (this.database!.schedules.length === initialLength) {
      return false;
    }

    await this.saveMetadata();
    console.log('[BackupManagement] Schedule deleted:', id);
    return true;
  }

  // =====================
  // Retention Policy
  // =====================

  /**
   * Apply retention policy to backups
   */
  public async applyRetention(policy: {
    daily: number;
    weekly: number;
    monthly: number;
  }): Promise<{ deleted: number; kept: number }> {
    if (!this.database) {
      await this.initialize();
    }

    const backups = await this.listBackups();
    const now = new Date();

    // Categorize backups
    const daily: BackupMetadata[] = [];
    const weekly: BackupMetadata[] = [];
    const monthly: BackupMetadata[] = [];
    const toDelete: BackupMetadata[] = [];

    for (const backup of backups) {
      const backupDate = new Date(backup.timestamp);
      const ageInDays = Math.floor((now.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24));

      if (ageInDays < policy.daily) {
        daily.push(backup);
      } else if (ageInDays < policy.daily + policy.weekly * 7) {
        weekly.push(backup);
      } else if (ageInDays < policy.daily + policy.weekly * 7 + policy.monthly * 30) {
        monthly.push(backup);
      } else {
        toDelete.push(backup);
      }
    }

    // Delete old backups
    for (const backup of toDelete) {
      await this.deleteBackup(backup.id);
    }

    console.log('[BackupManagement] Retention policy applied:', {
      deleted: toDelete.length,
      kept: backups.length - toDelete.length,
    });

    return {
      deleted: toDelete.length,
      kept: backups.length - toDelete.length,
    };
  }

  // =====================
  // Statistics
  // =====================

  /**
   * Get backup statistics
   */
  public async getStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    encrypted: number;
    oldestBackup?: string;
    newestBackup?: string;
  }> {
    if (!this.database) {
      await this.initialize();
    }

    const backups = this.database!.backups;

    const stats = {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      byType: {
        export: backups.filter(b => b.type === 'export').length,
        binary: backups.filter(b => b.type === 'binary').length,
      },
      bySource: {
        manual: backups.filter(b => b.source === 'manual').length,
        scheduled: backups.filter(b => b.source === 'scheduled').length,
      },
      encrypted: backups.filter(b => b.encrypted).length,
      oldestBackup: backups.length > 0
        ? backups.reduce((oldest, b) => b.timestamp < oldest ? b.timestamp : oldest, backups[0].timestamp)
        : undefined,
      newestBackup: backups.length > 0
        ? backups.reduce((newest, b) => b.timestamp > newest ? b.timestamp : newest, backups[0].timestamp)
        : undefined,
    };

    return stats;
  }
}

// Export singleton instance
export const backupManagementService = BackupManagementService.getInstance();
export default backupManagementService;
