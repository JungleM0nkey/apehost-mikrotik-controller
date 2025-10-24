import { Router, Request, Response } from 'express';

const router = Router();

// Mock router data - will be replaced with real MikroTik API calls
const mockRouterData = {
  name: 'RB4011',
  ip: '192.168.88.1',
  model: 'RB4011iGS+',
  version: '7.11',
  status: 'online'
};

// Get router status
router.get('/status', (req: Request, res: Response) => {
  res.json({
    ...mockRouterData,
    cpuLoad: 23,
    memoryUsed: 1258291200, // 1.2GB in bytes
    memoryTotal: 2147483648, // 2GB in bytes
    uptime: 1324800, // 15 days 7 hours in seconds
    timestamp: new Date().toISOString()
  });
});

// Get network interfaces
router.get('/interfaces', (req: Request, res: Response) => {
  res.json({
    interfaces: [
      {
        name: 'ether1-gateway',
        type: 'ether',
        status: 'up',
        rx: 1288490188, // 1.2 GB
        tx: 897581056, // 856 MB
        mtu: 1500
      },
      {
        name: 'ether2-local',
        type: 'ether',
        status: 'up',
        rx: 2684354560, // 2.5 GB
        tx: 1181116006, // 1.1 GB
        mtu: 1500
      },
      {
        name: 'ether3',
        type: 'ether',
        status: 'down',
        rx: 0,
        tx: 0,
        mtu: 1500
      },
      {
        name: 'wlan1',
        type: 'wlan',
        status: 'up',
        rx: 131072000, // 125 MB
        tx: 93323264, // 89 MB
        mtu: 1500
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Get resources (CPU, memory, etc.)
router.get('/resources', (req: Request, res: Response) => {
  res.json({
    cpu: {
      load: 23,
      cores: 4
    },
    memory: {
      used: 1258291200,
      total: 2147483648,
      percentage: 59
    },
    uptime: 1324800,
    version: '7.11 (stable)',
    boardName: 'RB4011iGS+',
    architecture: 'arm',
    timestamp: new Date().toISOString()
  });
});

export { router as routerRoutes };
