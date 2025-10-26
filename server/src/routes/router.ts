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

/**
 * PATCH /api/router/interfaces/:id
 * Update interface properties (name, comment, disabled status)
 */
routerRoutes.patch('/interfaces/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, comment, disabled } = req.body;

    const updatedInterface = await mikrotikService.updateInterface(id, {
      name,
      comment,
      disabled
    });

    res.json(updatedInterface);
  } catch (error: any) {
    console.error('Error updating interface:', error);
    res.status(500).json({
      error: 'Failed to update interface',
      message: error.message
    });
  }
});

/**
 * GET /api/router/ip/addresses
 * Get list of IP addresses
 */
routerRoutes.get('/ip/addresses', async (req: Request, res: Response) => {
  try {
    const addresses = await mikrotikService.getIpAddresses();
    res.json(addresses);
  } catch (error: any) {
    console.error('Error fetching IP addresses:', error);
    res.status(500).json({
      error: 'Failed to fetch IP addresses',
      message: error.message
    });
  }
});

/**
 * GET /api/router/ip/routes
 * Get routing table
 */
routerRoutes.get('/ip/routes', async (req: Request, res: Response) => {
  try {
    const routes = await mikrotikService.getRoutes();
    res.json(routes);
  } catch (error: any) {
    console.error('Error fetching routes:', error);
    res.status(500).json({
      error: 'Failed to fetch routes',
      message: error.message
    });
  }
});

/**
 * GET /api/router/ip/arp
 * Get ARP table
 */
routerRoutes.get('/ip/arp', async (req: Request, res: Response) => {
  try {
    const arpTable = await mikrotikService.getArpTable();
    res.json(arpTable);
  } catch (error: any) {
    console.error('Error fetching ARP table:', error);
    res.status(500).json({
      error: 'Failed to fetch ARP table',
      message: error.message
    });
  }
});

/**
 * GET /api/router/export
 * Export router configuration as .rsc file
 */
routerRoutes.get('/export', async (req: Request, res: Response) => {
  try {
    const config = await mikrotikService.exportConfig();

    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="router-config.rsc"');

    res.send(config);
  } catch (error: any) {
    console.error('Error exporting configuration:', error);
    res.status(500).json({
      error: 'Failed to export configuration',
      message: error.message
    });
  }
});

/**
 * GET /api/router/firewall/filter
 * Get firewall filter rules
 */
routerRoutes.get('/firewall/filter', async (req: Request, res: Response) => {
  try {
    const rules = await mikrotikService.getFirewallFilterRules();
    res.json(rules);
  } catch (error: any) {
    console.error('Error fetching firewall filter rules:', error);
    res.status(500).json({
      error: 'Failed to fetch firewall filter rules',
      message: error.message
    });
  }
});

/**
 * GET /api/router/firewall/nat
 * Get firewall NAT rules
 */
routerRoutes.get('/firewall/nat', async (req: Request, res: Response) => {
  try {
    const rules = await mikrotikService.getFirewallNatRules();
    res.json(rules);
  } catch (error: any) {
    console.error('Error fetching firewall NAT rules:', error);
    res.status(500).json({
      error: 'Failed to fetch firewall NAT rules',
      message: error.message
    });
  }
});

/**
 * GET /api/router/firewall/mangle
 * Get firewall mangle rules
 */
routerRoutes.get('/firewall/mangle', async (req: Request, res: Response) => {
  try {
    const rules = await mikrotikService.getFirewallMangleRules();
    res.json(rules);
  } catch (error: any) {
    console.error('Error fetching firewall mangle rules:', error);
    res.status(500).json({
      error: 'Failed to fetch firewall mangle rules',
      message: error.message
    });
  }
});

/**
 * GET /api/router/firewall/address-list
 * Get firewall address lists
 */
routerRoutes.get('/firewall/address-list', async (req: Request, res: Response) => {
  try {
    const lists = await mikrotikService.getFirewallAddressLists();
    res.json(lists);
  } catch (error: any) {
    console.error('Error fetching firewall address lists:', error);
    res.status(500).json({
      error: 'Failed to fetch firewall address lists',
      message: error.message
    });
  }
});

/**
 * GET /api/router/scan/dhcp-leases
 * Get DHCP server leases with hostname information
 */
routerRoutes.get('/scan/dhcp-leases', async (req: Request, res: Response) => {
  try {
    const leases = await mikrotikService.getDhcpLeases();
    res.json(leases);
  } catch (error: any) {
    console.error('Error fetching DHCP leases:', error);
    res.status(500).json({
      error: 'Failed to fetch DHCP leases',
      message: error.message
    });
  }
});

/**
 * GET /api/router/scan/neighbors
 * Get network neighbor discovery data (LLDP/CDP/MNDP)
 */
routerRoutes.get('/scan/neighbors', async (req: Request, res: Response) => {
  try {
    const neighbors = await mikrotikService.getNeighbors();
    res.json(neighbors);
  } catch (error: any) {
    console.error('Error fetching neighbors:', error);
    res.status(500).json({
      error: 'Failed to fetch neighbors',
      message: error.message
    });
  }
});

/**
 * GET /api/router/scan/full
 * Perform comprehensive network scan combining ARP, DHCP, and neighbor discovery
 */
routerRoutes.get('/scan/full', async (req: Request, res: Response) => {
  try {
    const scanResults = await mikrotikService.performNetworkScan();
    res.json(scanResults);
  } catch (error: any) {
    console.error('Error performing network scan:', error);
    res.status(500).json({
      error: 'Failed to perform network scan',
      message: error.message
    });
  }
});

/**
 * GET /api/router/speed-test
 * Perform internet speed test (latency and download speed)
 */
routerRoutes.get('/speed-test', async (req: Request, res: Response) => {
  try {
    const speedResults = await mikrotikService.performSpeedTest();
    res.json(speedResults);
  } catch (error: any) {
    console.error('Error performing speed test:', error);
    res.status(500).json({
      error: 'Failed to perform speed test',
      message: error.message
    });
  }
});
