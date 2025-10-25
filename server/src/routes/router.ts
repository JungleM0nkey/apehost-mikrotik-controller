import { Router, Request, Response } from 'express';
import mikrotikService from '../services/mikrotik.js';

export const routerRoutes = Router();

/**
 * GET /api/router/status
 * Get router system status and information
 */
routerRoutes.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await mikrotikService.getRouterStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Error fetching router status:', error);
    res.status(500).json({
      error: 'Failed to fetch router status',
      message: error.message
    });
  }
});

/**
 * GET /api/router/interfaces
 * Get list of network interfaces
 */
routerRoutes.get('/interfaces', async (req: Request, res: Response) => {
  try {
    const interfaces = await mikrotikService.getInterfaces();
    res.json(interfaces);
  } catch (error: any) {
    console.error('Error fetching interfaces:', error);
    res.status(500).json({
      error: 'Failed to fetch interfaces',
      message: error.message
    });
  }
});

/**
 * GET /api/router/resources
 * Get system resources (CPU, memory, etc.)
 */
routerRoutes.get('/resources', async (req: Request, res: Response) => {
  try {
    const resources = await mikrotikService.getSystemResources();
    
    // Parse and format resources
    const totalMemory = mikrotikService.parseBytes(resources['total-memory'] || '0');
    const freeMemory = mikrotikService.parseBytes(resources['free-memory'] || '0');
    const usedMemory = totalMemory - freeMemory;
    
    const formatted = {
      cpu: {
        load: parseInt(String(resources['cpu-load'] || '0').replace('%', '')),
        count: parseInt(resources['cpu-count'] || '1')
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100)
      },
      disk: {
        used: 0,
        total: 0,
        percentage: 0
      },
      uptime: mikrotikService.parseUptime(resources.uptime || '0s'),
      timestamp: new Date().toISOString()
    };
    
    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching resources:', error);
    res.status(500).json({
      error: 'Failed to fetch system resources',
      message: error.message
    });
  }
});
