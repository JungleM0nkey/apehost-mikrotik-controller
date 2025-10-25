import { Router, Request, Response } from 'express';
import os from 'os';

export const serviceRoutes = Router();

/**
 * GET /api/service/info
 * Get service information (IP, port, uptime, etc.)
 */
serviceRoutes.get('/info', (req: Request, res: Response) => {
  const networkInterfaces = os.networkInterfaces();
  const addresses: string[] = [];

  // Get all IPv4 addresses
  Object.values(networkInterfaces).forEach(netInterface => {
    netInterface?.forEach(details => {
      if (details.family === 'IPv4' && !details.internal) {
        addresses.push(details.address);
      }
    });
  });

  const uptime = process.uptime();
  const port = process.env.PORT || '3000';

  res.json({
    service: 'backend',
    status: 'online',
    addresses,
    port,
    uptime: Math.floor(uptime),
    uptimeFormatted: formatUptime(uptime),
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/service/restart
 * Restart the service (graceful shutdown + process manager restart)
 */
serviceRoutes.post('/restart', (req: Request, res: Response) => {
  console.log('[Service] Restart requested via API');

  res.json({
    message: 'Server restart initiated',
    timestamp: new Date().toISOString(),
  });

  // Trigger graceful shutdown which will cause process manager to restart
  setTimeout(() => {
    console.log('[Service] Initiating graceful restart...');
    process.exit(0);
  }, 1000);
});

/**
 * POST /api/service/shutdown
 * Shutdown the service (graceful shutdown)
 */
serviceRoutes.post('/shutdown', (req: Request, res: Response) => {
  console.log('[Service] Shutdown requested via API');

  res.json({
    message: 'Server shutdown initiated',
    timestamp: new Date().toISOString(),
  });

  // Trigger graceful shutdown
  setTimeout(() => {
    console.log('[Service] Initiating graceful shutdown...');
    process.exit(0);
  }, 1000);
});

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
