/**
 * Backup Management Routes
 *
 * API endpoints for managing router backups, schedules, and retention policies.
 */

import { Router, Request, Response } from 'express';
import backupManagementService from '../services/backup-management.service.js';
import { globalMCPExecutor } from '../services/ai/mcp/mcp-executor.js';
import type { ToolExecutionContext } from '../services/ai/mcp/types.js';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export const backupRoutes = Router();

// =====================
// Backup Operations
// =====================

/**
 * GET /api/backups
 * List all backups with optional filtering
 */
backupRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const filter = {
      type: req.query.type as 'export' | 'binary' | undefined,
      source: req.query.source as 'manual' | 'scheduled' | undefined,
      encrypted: req.query.encrypted === 'true' ? true : req.query.encrypted === 'false' ? false : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const backups = await backupManagementService.listBackups(filter);
    res.json({ success: true, backups });
  } catch (error: any) {
    console.error('Error listing backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list backups',
      message: error.message,
    });
  }
});

/**
 * GET /api/backups/stats
 * Get backup statistics
 */
backupRoutes.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await backupManagementService.getStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Error getting backup stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup statistics',
      message: error.message,
    });
  }
});

/**
 * GET /api/backups/:id
 * Get specific backup details
 */
backupRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const backup = await backupManagementService.getBackup(id);

    if (!backup) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found',
      });
    }

    res.json({ success: true, backup });
  } catch (error: any) {
    console.error('Error getting backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup',
      message: error.message,
    });
  }
});

/**
 * POST /api/backups/export
 * Create new export backup (.rsc)
 */
backupRoutes.post('/export', async (req: Request, res: Response) => {
  try {
    const { filename, section } = req.body;

    // Call MCP tool to create export
    const context: ToolExecutionContext = {
      sessionId: uuidv4(),
      conversationId: 'api-export',
      timestamp: new Date(),
    };

    const exportTool = globalMCPExecutor.getTool('backup_export_config');
    if (!exportTool) {
      return res.status(500).json({
        success: false,
        error: 'Export tool not available',
      });
    }

    const result = await exportTool.execute({ filename, section }, context);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Export failed',
      });
    }

    // Register in metadata
    const data = result.data as any;
    const metadata = await backupManagementService.registerBackup({
      filename: data.filename,
      type: 'export',
      timestamp: data.created,
      size: data.size,
      encrypted: false,
      source: 'manual',
      localPath: '', // Will be updated on download
    });

    res.json({
      success: true,
      backup: metadata,
      message: data.message,
    });
  } catch (error: any) {
    console.error('Error creating export:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create export',
      message: error.message,
    });
  }
});

/**
 * POST /api/backups/binary
 * Create new binary backup (.backup)
 */
backupRoutes.post('/binary', async (req: Request, res: Response) => {
  try {
    const { name, password, encryption } = req.body;

    // Call MCP tool to create binary backup
    const context: ToolExecutionContext = {
      sessionId: uuidv4(),
      conversationId: 'api-binary',
      timestamp: new Date(),
    };

    const binaryTool = globalMCPExecutor.getTool('backup_create_binary');
    if (!binaryTool) {
      return res.status(500).json({
        success: false,
        error: 'Binary backup tool not available',
      });
    }

    const result = await binaryTool.execute({ name, password, encryption }, context);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Binary backup failed',
      });
    }

    // Register in metadata
    const data = result.data as any;
    const metadata = await backupManagementService.registerBackup({
      filename: data.filename,
      type: 'binary',
      timestamp: data.created,
      size: data.size,
      encrypted: data.encrypted,
      source: 'manual',
      localPath: '', // Will be updated on download
    });

    res.json({
      success: true,
      backup: metadata,
      message: data.message,
      warning: data.warning,
    });
  } catch (error: any) {
    console.error('Error creating binary backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create binary backup',
      message: error.message,
    });
  }
});

/**
 * POST /api/backups/:id/download
 * Download backup file from router to server
 */
backupRoutes.post('/:id/download', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const backup = await backupManagementService.getBackup(id);

    if (!backup) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found',
      });
    }

    // Call MCP tool to download file
    const context: ToolExecutionContext = {
      sessionId: uuidv4(),
      conversationId: 'api-download',
      timestamp: new Date(),
    };

    const downloadTool = globalMCPExecutor.getTool('backup_download_file');
    if (!downloadTool) {
      return res.status(500).json({
        success: false,
        error: 'Download tool not available',
      });
    }

    const result = await downloadTool.execute({ filename: backup.filename }, context);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Download failed',
      });
    }

    // Update metadata with local path
    const data = result.data as any;
    await backupManagementService.updateBackup(id, {
      localPath: data.localPath,
      size: data.size,
    });

    res.json({
      success: true,
      message: data.message,
      localPath: data.localPath,
    });
  } catch (error: any) {
    console.error('Error downloading backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download backup',
      message: error.message,
    });
  }
});

/**
 * GET /api/backups/:id/file
 * Download backup file to client
 */
backupRoutes.get('/:id/file', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const backup = await backupManagementService.getBackup(id);

    if (!backup) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found',
      });
    }

    if (!backup.localPath) {
      return res.status(400).json({
        success: false,
        error: 'Backup not downloaded to server yet. Use POST /api/backups/:id/download first.',
      });
    }

    // Check if file exists
    try {
      await fs.access(backup.localPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Backup file not found on server',
      });
    }

    // Send file
    res.download(backup.localPath, backup.filename);
  } catch (error: any) {
    console.error('Error sending backup file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send backup file',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/backups/:id
 * Delete backup
 */
backupRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await backupManagementService.deleteBackup(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found',
      });
    }

    res.json({
      success: true,
      message: 'Backup deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup',
      message: error.message,
    });
  }
});

// =====================
// Schedule Operations
// =====================

/**
 * GET /api/backups/schedules
 * List all backup schedules
 */
backupRoutes.get('/schedules/list', async (req: Request, res: Response) => {
  try {
    const schedules = await backupManagementService.listSchedules();
    res.json({ success: true, schedules });
  } catch (error: any) {
    console.error('Error listing schedules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list schedules',
      message: error.message,
    });
  }
});

/**
 * POST /api/backups/schedules
 * Create new backup schedule
 */
backupRoutes.post('/schedules', async (req: Request, res: Response) => {
  try {
    const { name, type, cron, enabled, retention, password } = req.body;

    const schedule = await backupManagementService.createSchedule({
      name,
      type,
      cron,
      enabled,
      retention,
      password,
    });

    res.json({
      success: true,
      schedule,
      message: 'Schedule created successfully',
    });
  } catch (error: any) {
    console.error('Error creating schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create schedule',
      message: error.message,
    });
  }
});

/**
 * PUT /api/backups/schedules/:id
 * Update backup schedule
 */
backupRoutes.put('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const success = await backupManagementService.updateSchedule(id, updates);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      message: 'Schedule updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update schedule',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/backups/schedules/:id
 * Delete backup schedule
 */
backupRoutes.delete('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await backupManagementService.deleteSchedule(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      message: 'Schedule deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete schedule',
      message: error.message,
    });
  }
});

// =====================
// Retention Policy
// =====================

/**
 * POST /api/backups/retention
 * Apply retention policy
 */
backupRoutes.post('/retention', async (req: Request, res: Response) => {
  try {
    const { daily, weekly, monthly } = req.body;

    const result = await backupManagementService.applyRetention({
      daily,
      weekly,
      monthly,
    });

    res.json({
      success: true,
      result,
      message: `Retention policy applied. Deleted: ${result.deleted}, Kept: ${result.kept}`,
    });
  } catch (error: any) {
    console.error('Error applying retention policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply retention policy',
      message: error.message,
    });
  }
});
