import { Router, Request, Response } from 'express';
import mikrotikService from '../services/mikrotik.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Don't wait for router health check - make it non-blocking
    const routerHealthPromise = mikrotikService.healthCheck();
    const routerHealth = await Promise.race([
      routerHealthPromise,
      new Promise((resolve) => setTimeout(() => resolve({
        connected: false,
        connectedSince: null,
        lastError: 'Health check timed out',
        routerIdentity: null,
        host: process.env.MIKROTIK_HOST || 'unknown',
        port: parseInt(process.env.MIKROTIK_PORT || '8728'),
      }), 2000)) // 2 second timeout for health check
    ]);
    
    res.json({
      status: 'ok',
      pid: process.pid,
      port: process.env.PORT || 3000,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: {
        host: process.env.MIKROTIK_HOST,
        port: process.env.MIKROTIK_PORT,
      },
      router: routerHealth,
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as healthRoutes };
