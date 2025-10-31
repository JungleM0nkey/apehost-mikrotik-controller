/**
 * WireGuard VPN Tool
 *
 * Provides access to WireGuard VPN configuration and peer management for the AI assistant.
 * Allows querying VPN status, peer connections, and configuration details.
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import { wireguardService } from '../../../wireguard/wireguard.service.js';

export class WireguardTool extends BaseMCPTool {
  readonly name = 'get_wireguard_info';
  readonly description =
    'Get WireGuard VPN configuration and peer information. Use this when the user asks about VPN status, connected peers, VPN configuration, or troubleshooting VPN connectivity issues.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'peers', 'interface', 'stats'],
        description:
          'What information to retrieve: status (overall VPN status), peers (list all peers), interface (interface configuration), stats (VPN statistics)',
      },
    },
    required: ['action'],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate input
      const validation = this.validateInput(params);
      if (!validation.valid) {
        return this.error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      const { action } = params as { action: string };

      let data: any;

      switch (action) {
        case 'status':
          data = await this.getStatus();
          break;

        case 'peers':
          data = await this.getPeers();
          break;

        case 'interface':
          data = await this.getInterface();
          break;

        case 'stats':
          data = await this.getStats();
          break;

        default:
          return this.error(`Unknown action: ${action}`);
      }

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          action,
          data,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to retrieve WireGuard info',
        executionTime
      );
    }
  }

  /**
   * Get overall WireGuard VPN status
   */
  private async getStatus(): Promise<any> {
    const [iface, peers, stats] = await Promise.all([
      wireguardService.getInterface(),
      wireguardService.getPeers(),
      wireguardService.getStats(),
    ]);

    if (!iface) {
      return {
        configured: false,
        message: 'WireGuard VPN is not configured',
      };
    }

    const activePeers = peers.filter(
      p => p.lastHandshake && new Date().getTime() - p.lastHandshake.getTime() < 3 * 60 * 1000
    );

    return {
      configured: true,
      enabled: iface.enabled,
      interface: {
        name: iface.name,
        address: iface.address,
        listenPort: iface.listenPort,
        mtu: iface.mtu,
      },
      peers: {
        total: peers.length,
        active: activePeers.length,
        inactive: peers.length - activePeers.length,
      },
      statistics: stats,
    };
  }

  /**
   * Get list of all VPN peers with connection status
   */
  private async getPeers(): Promise<any> {
    const peers = await wireguardService.getPeers();

    if (peers.length === 0) {
      return {
        count: 0,
        peers: [],
        message: 'No VPN peers configured',
      };
    }

    const now = new Date().getTime();
    const peerData = peers.map(peer => {
      const connected =
        peer.lastHandshake !== undefined &&
        now - peer.lastHandshake.getTime() < 3 * 60 * 1000;

      return {
        name: peer.name,
        allowedIPs: peer.allowedIPs,
        connected,
        lastHandshake: peer.lastHandshake
          ? {
              timestamp: peer.lastHandshake.toISOString(),
              minutesAgo: Math.floor((now - peer.lastHandshake.getTime()) / 60000),
            }
          : null,
        traffic: {
          rxBytes: peer.rxBytes || 0,
          txBytes: peer.txBytes || 0,
          rxMB: ((peer.rxBytes || 0) / 1024 / 1024).toFixed(2),
          txMB: ((peer.txBytes || 0) / 1024 / 1024).toFixed(2),
        },
        endpoint: peer.currentEndpoint || peer.endpoint || null,
      };
    });

    return {
      count: peers.length,
      peers: peerData,
      summary: {
        connected: peerData.filter(p => p.connected).length,
        disconnected: peerData.filter(p => !p.connected).length,
      },
    };
  }

  /**
   * Get WireGuard interface configuration
   */
  private async getInterface(): Promise<any> {
    const iface = await wireguardService.getInterface();

    if (!iface) {
      return {
        configured: false,
        message: 'WireGuard interface is not configured',
      };
    }

    return {
      configured: true,
      name: iface.name,
      address: iface.address,
      listenPort: iface.listenPort,
      publicKey: iface.publicKey,
      mtu: iface.mtu,
      enabled: iface.enabled,
    };
  }

  /**
   * Get VPN statistics
   */
  private async getStats(): Promise<any> {
    const stats = await wireguardService.getStats();

    return {
      totalPeers: stats.totalPeers,
      activePeers: stats.activePeers,
      inactivePeers: stats.totalPeers - stats.activePeers,
      traffic: {
        totalRx: stats.totalRx,
        totalTx: stats.totalTx,
        totalRxMB: (stats.totalRx / 1024 / 1024).toFixed(2),
        totalTxMB: (stats.totalTx / 1024 / 1024).toFixed(2),
        totalGB: ((stats.totalRx + stats.totalTx) / 1024 / 1024 / 1024).toFixed(2),
      },
    };
  }
}
