/**
 * Host Discovery Tool - Comprehensive Host Information
 *
 * Provides complete host discovery by combining multiple data sources:
 * - ARP table (IP to MAC mapping, interface, reachability)
 * - DHCP leases (hostnames, lease status)
 * - Interface configuration (network segments)
 * - Neighbor discovery (LLDP/CDP/MNDP for network devices)
 *
 * This is the authoritative tool for "what is this IP address" questions.
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

interface EnhancedHost {
  address: string;
  macAddress: string;
  interface: string;
  hostname: string;
  arpStatus: string;
  dhcpStatus: string;
  dhcpServer: string;
  expiresAfter: string;
  lastSeen: string;
  isNeighborDevice: boolean;
  neighborIdentity: string;
  neighborPlatform: string;
  neighborVersion: string;
  discoveredBy: string;
  dynamic: boolean;
  complete: boolean;
  disabled: boolean;
  comment: string;
  network?: string;
  subnet?: string;
}

export class HostDiscoveryTool extends BaseMCPTool {
  readonly name = 'discover_host';
  readonly description =
    'Discover comprehensive information about a host on the network. Combines ARP table, DHCP leases, interface configuration, and neighbor discovery to provide complete host details including IP, MAC, hostname, interface, network segment, and reachability status. Use this for "what host is X.X.X.X" or "find device" questions.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Discovery action: lookup specific IP/MAC, scan all hosts, or scan network segment',
        enum: ['lookup', 'scan', 'scan_segment'],
      },
      address: {
        type: 'string',
        description: 'IP address to lookup (for lookup action)',
      },
      mac_address: {
        type: 'string',
        description: 'MAC address to search for (for lookup action)',
      },
      interface: {
        type: 'string',
        description: 'Interface name to filter by (for scan or scan_segment actions)',
      },
      network: {
        type: 'string',
        description: 'Network segment to scan (e.g., 192.168.88.0/24) (for scan_segment action)',
      },
    },
    required: ['action'],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const validation = this.validateInput(params);
      if (!validation.valid) {
        return this.error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      if (!mikrotikService || !mikrotikService.isConnectionActive()) {
        return this.error('MikroTik router connection not available');
      }

      const action = params.action as string;

      switch (action) {
        case 'lookup':
          return await this.lookupHost(params, startTime);
        case 'scan':
          return await this.scanAllHosts(params, startTime);
        case 'scan_segment':
          return await this.scanNetworkSegment(params, startTime);
        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Host discovery failed',
        executionTime
      );
    }
  }

  private async lookupHost(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const targetIp = params.address as string | undefined;
    const targetMac = params.mac_address as string | undefined;

    if (!targetIp && !targetMac) {
      return this.error('address or mac_address parameter required for lookup');
    }

    const insights: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Perform comprehensive network scan
    const scanData = await mikrotikService.performNetworkScan();
    const { arpTable, dhcpLeases, neighbors, enhancedHosts } = scanData;

    // Filter enhanced hosts by IP or MAC
    let matchingHosts: EnhancedHost[] = [];

    if (targetIp) {
      matchingHosts = enhancedHosts.filter((host: any) => host.address === targetIp);
      insights.push(`Searching for host with IP ${targetIp}`);
    }

    if (targetMac) {
      const macUpper = targetMac.toUpperCase().replace(/[:-]/g, ':');
      matchingHosts = enhancedHosts.filter((host: any) => {
        const hostMac = (host.macAddress || '').toUpperCase().replace(/[:-]/g, ':');
        return hostMac === macUpper;
      });
      insights.push(`Searching for host with MAC ${targetMac}`);
    }

    // Get interface information to determine network segment
    const interfaces = await mikrotikService.getIpAddresses();

    if (matchingHosts.length === 0) {
      if (targetIp) {
        warnings.push(`Host ${targetIp} not found in network data`);
        recommendations.push('Host may be offline or not yet discovered');
        recommendations.push('Try pinging the host to trigger ARP resolution: /ping address=' + targetIp);
        recommendations.push('Check if IP is within configured network segments');

        // Check which network segment this IP belongs to
        const belongsToNetwork = interfaces.find((iface: any) => {
          const network = iface.network;
          if (!network) return false;
          // Simple network matching (would need CIDR calculation for proper subnet check)
          const ipParts = targetIp.split('.');
          const netParts = network.split('.');
          return ipParts[0] === netParts[0] && ipParts[1] === netParts[1] && ipParts[2] === netParts[2];
        });

        if (belongsToNetwork) {
          insights.push(`IP ${targetIp} is in network ${belongsToNetwork.address} on interface ${belongsToNetwork.interface}`);
        } else {
          warnings.push(`IP ${targetIp} does not match any configured network segments`);
        }
      } else if (targetMac) {
        warnings.push(`Host with MAC ${targetMac} not found in network data`);
        recommendations.push('Device may not be connected to this network');
        recommendations.push('Check physical connections and switch port status');
      }

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          action: 'lookup',
          found: false,
          query: {
            address: targetIp,
            mac_address: targetMac,
          },
          hosts: [],
          interfaces: interfaces.map((iface: any) => ({
            name: iface.interface,
            address: iface.address,
            network: iface.network,
          })),
          insights,
          warnings,
          recommendations,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    }

    // Found matching host(s)
    if (matchingHosts.length === 1) {
      const host = matchingHosts[0];
      insights.push(`Found host: ${host.address}`);
      insights.push(`MAC address: ${host.macAddress}`);
      insights.push(`Interface: ${host.interface || 'Unknown'}`);

      if (host.hostname) {
        insights.push(`Hostname: ${host.hostname}`);
      }

      if (host.arpStatus) {
        insights.push(`ARP Status: ${host.arpStatus}`);
      }

      if (host.dhcpStatus) {
        insights.push(`DHCP Status: ${host.dhcpStatus}`);
      }

      if (host.isNeighborDevice) {
        insights.push(`Network Device: ${host.neighborIdentity} (${host.neighborPlatform})`);
      }

      // Find network segment
      if (host.interface) {
        const ifaceConfig = interfaces.find((iface: any) => iface.interface === host.interface);
        if (ifaceConfig) {
          insights.push(`Network Segment: ${ifaceConfig.address}`);
          host.network = ifaceConfig.network;
          host.subnet = ifaceConfig.address.split('/')[1];
        }
      }

      if (!host.complete) {
        warnings.push('ARP entry is incomplete - host may not be fully reachable');
        recommendations.push('Try pinging the host again to refresh ARP');
      }

      if (host.dhcpStatus === 'waiting') {
        warnings.push('DHCP lease is in waiting state');
        recommendations.push('Host may be requesting a DHCP lease');
      }
    } else if (matchingHosts.length > 1) {
      warnings.push(`Found ${matchingHosts.length} matching hosts (possible conflict)`);
      if (targetMac) {
        warnings.push(`MAC address ${targetMac} appears multiple times`);
        recommendations.push('Check for MAC address conflicts or VLAN configuration');
      } else {
        warnings.push(`IP address ${targetIp} appears multiple times`);
        recommendations.push('Check for IP address conflicts on the network');
      }
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'lookup',
        found: true,
        query: {
          address: targetIp,
          mac_address: targetMac,
        },
        hosts: matchingHosts,
        count: matchingHosts.length,
        interfaces: interfaces.map((iface: any) => ({
          name: iface.interface,
          address: iface.address,
          network: iface.network,
        })),
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }

  private async scanAllHosts(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const filterInterface = params.interface as string | undefined;

    const insights: string[] = ['Performing comprehensive network scan'];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Perform comprehensive network scan
    const scanData = await mikrotikService.performNetworkScan();
    const { arpTable, dhcpLeases, neighbors, enhancedHosts } = scanData;

    // Filter by interface if specified
    let filteredHosts = enhancedHosts;
    if (filterInterface) {
      filteredHosts = enhancedHosts.filter((host: any) => host.interface === filterInterface);
      insights.push(`Filtered to interface: ${filterInterface}`);
    }

    // Get interface information for network segments
    const interfaces = await mikrotikService.getIpAddresses();

    // Statistics
    const totalHosts = filteredHosts.length;
    const withHostname = filteredHosts.filter((h: any) => h.hostname).length;
    const neighborDevices = filteredHosts.filter((h: any) => h.isNeighborDevice).length;
    const completeArp = filteredHosts.filter((h: any) => h.complete).length;

    insights.push(`Discovered ${totalHosts} host(s)`);
    insights.push(`${withHostname} with hostnames`);
    insights.push(`${neighborDevices} network devices`);
    insights.push(`${completeArp} with complete ARP entries`);

    // Check for potential issues
    const incompleteArp = totalHosts - completeArp;
    if (incompleteArp > 0) {
      warnings.push(`${incompleteArp} host(s) have incomplete ARP entries`);
      recommendations.push('Incomplete ARP entries may indicate connectivity issues');
    }

    // Check for hosts without hostnames
    const withoutHostname = totalHosts - withHostname;
    if (withoutHostname > 0) {
      insights.push(`${withoutHostname} host(s) without hostnames (likely static IPs)`);
    }

    // Group hosts by interface
    const byInterface = new Map<string, number>();
    filteredHosts.forEach((host: any) => {
      const iface = host.interface || 'unknown';
      byInterface.set(iface, (byInterface.get(iface) || 0) + 1);
    });

    insights.push('Hosts by interface:');
    byInterface.forEach((count, iface) => {
      insights.push(`  ${iface}: ${count} host(s)`);
    });

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'scan',
        filter: {
          interface: filterInterface,
        },
        hosts: filteredHosts,
        count: totalHosts,
        statistics: {
          total: totalHosts,
          withHostname,
          neighborDevices,
          completeArp,
          incompleteArp,
          withoutHostname,
        },
        interfaces: interfaces.map((iface: any) => ({
          name: iface.interface,
          address: iface.address,
          network: iface.network,
        })),
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
        scanDuration: `${executionTime}ms`,
      },
      executionTime
    );
  }

  private async scanNetworkSegment(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const targetNetwork = params.network as string | undefined;
    const filterInterface = params.interface as string | undefined;

    if (!targetNetwork && !filterInterface) {
      return this.error('network or interface parameter required for scan_segment');
    }

    const insights: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Get interface configuration
    const interfaces = await mikrotikService.getIpAddresses();

    // Find matching interface
    let targetInterface: any = null;
    if (targetNetwork) {
      targetInterface = interfaces.find((iface: any) =>
        iface.network === targetNetwork || iface.address.startsWith(targetNetwork)
      );
      if (!targetInterface) {
        warnings.push(`Network segment ${targetNetwork} not found in router configuration`);
        recommendations.push('Check configured IP addresses on interfaces');
        recommendations.push('Use /ip address print to see all configured networks');
      }
    } else if (filterInterface) {
      targetInterface = interfaces.find((iface: any) => iface.interface === filterInterface);
      if (!targetInterface) {
        warnings.push(`Interface ${filterInterface} not found`);
      }
    }

    if (targetInterface) {
      insights.push(`Scanning network segment: ${targetInterface.address}`);
      insights.push(`Interface: ${targetInterface.interface}`);
    }

    // Perform comprehensive network scan
    const scanData = await mikrotikService.performNetworkScan();
    const { enhancedHosts } = scanData;

    // Filter hosts by interface
    const filteredHosts = targetInterface
      ? enhancedHosts.filter((host: any) => host.interface === targetInterface.interface)
      : [];

    const totalHosts = filteredHosts.length;
    const withHostname = filteredHosts.filter((h: any) => h.hostname).length;
    const neighborDevices = filteredHosts.filter((h: any) => h.isNeighborDevice).length;

    insights.push(`Found ${totalHosts} host(s) on this segment`);
    if (withHostname > 0) {
      insights.push(`${withHostname} with hostnames`);
    }
    if (neighborDevices > 0) {
      insights.push(`${neighborDevices} network devices`);
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'scan_segment',
        filter: {
          network: targetNetwork,
          interface: filterInterface,
        },
        segment: targetInterface ? {
          interface: targetInterface.interface,
          address: targetInterface.address,
          network: targetInterface.network,
        } : null,
        hosts: filteredHosts,
        count: totalHosts,
        statistics: {
          total: totalHosts,
          withHostname,
          neighborDevices,
        },
        interfaces: interfaces.map((iface: any) => ({
          name: iface.interface,
          address: iface.address,
          network: iface.network,
        })),
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
        scanDuration: `${executionTime}ms`,
      },
      executionTime
    );
  }
}
