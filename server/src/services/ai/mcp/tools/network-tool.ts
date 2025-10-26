/**
 * Network Tool - Layer 2/3 Network Information
 *
 * Provides:
 * - ARP table lookups (IP to MAC mapping)
 * - DNS resolution testing
 * - DHCP lease information
 * - IP address assignments
 * - Neighbor discovery
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class NetworkTool extends BaseMCPTool {
  readonly name = 'query_network';
  readonly description =
    'Query network layer information for troubleshooting connectivity issues. Can lookup ARP entries (IP→MAC), test DNS resolution, check DHCP leases, or list IP addresses. Use this when diagnosing "host not found" or MAC address conflicts.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Information to query: ARP table, DNS resolution, DHCP leases, or IP addresses',
        enum: ['arp', 'dns', 'dhcp', 'addresses'],
      },
      address: {
        type: 'string',
        description: 'IP address or hostname to lookup (for arp, dns actions)',
      },
      mac_address: {
        type: 'string',
        description: 'MAC address to search for (for arp action)',
      },
      interface: {
        type: 'string',
        description: 'Filter by specific interface (for arp, dhcp, addresses actions)',
      },
      hostname: {
        type: 'string',
        description: 'Hostname to resolve (for dns action)',
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
        case 'arp':
          return await this.queryArp(params, startTime);
        case 'dns':
          return await this.queryDns(params, startTime);
        case 'dhcp':
          return await this.queryDhcp(params, startTime);
        case 'addresses':
          return await this.queryAddresses(params, startTime);
        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Network query failed',
        executionTime
      );
    }
  }

  private async queryArp(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const targetIp = params.address as string | undefined;
    const targetMac = params.mac_address as string | undefined;
    const iface = params.interface as string | undefined;

    // Get ARP table
    const arpTable = await mikrotikService.getArpTable();

    // Filter entries
    let filtered = arpTable.filter((entry: any) => !entry.invalid);

    if (targetIp) {
      filtered = filtered.filter((entry: any) => entry.address === targetIp);
    }

    if (targetMac) {
      const macUpper = targetMac.toUpperCase().replace(/[:-]/g, ':');
      filtered = filtered.filter((entry: any) => {
        const entryMac = (entry['mac-address'] || '').toUpperCase().replace(/[:-]/g, ':');
        return entryMac === macUpper;
      });
    }

    if (iface) {
      filtered = filtered.filter((entry: any) => entry.interface === iface);
    }

    // Build insights
    const insights: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (targetIp || targetMac) {
      insights.push(`Searching ARP table for ${targetIp || targetMac}`);
    } else {
      insights.push(`Retrieved ${filtered.length} ARP entries`);
    }

    if (filtered.length === 0) {
      if (targetIp) {
        warnings.push(`No ARP entry found for ${targetIp}`);
        recommendations.push('Host may be offline or unreachable');
        recommendations.push('Try pinging the host to trigger ARP resolution');
        recommendations.push('Check if host is on the correct network segment');
      } else if (targetMac) {
        warnings.push(`No ARP entry found for MAC ${targetMac}`);
        recommendations.push('Device may not be connected to this network');
        recommendations.push('Check physical connections and switch port status');
      } else {
        insights.push('ARP table is empty - no active hosts detected');
      }
    } else if (targetIp && filtered.length === 1) {
      const entry = filtered[0];
      insights.push(`Found ARP entry: ${entry.address} → ${entry['mac-address']}`);
      insights.push(`Interface: ${entry.interface}`);
      insights.push(`Status: ${entry.complete ? 'Complete' : 'Incomplete'}`);

      if (!entry.complete) {
        warnings.push('ARP entry is incomplete - resolution may have failed');
        recommendations.push('Try pinging the host again to refresh ARP');
      }
    } else if (targetMac && filtered.length > 1) {
      warnings.push(`MAC address ${targetMac} appears ${filtered.length} times (possible conflict)`);
      recommendations.push('Check for duplicate MAC addresses on the network');
      recommendations.push('Review DHCP server configuration for static leases');
    }

    // Check for duplicate IPs
    if (!targetIp && !targetMac) {
      const ipCounts = new Map<string, number>();
      filtered.forEach((entry: any) => {
        const ip = entry.address;
        ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
      });

      const duplicates = Array.from(ipCounts.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        warnings.push(`Found ${duplicates.length} duplicate IP address(es) in ARP table`);
        duplicates.forEach(([ip, count]) => {
          warnings.push(`  ${ip} appears ${count} times`);
        });
        recommendations.push('Investigate IP address conflicts on the network');
        recommendations.push('Check DHCP server configuration and static IP assignments');
      }
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'arp',
        filter: {
          address: targetIp,
          mac_address: targetMac,
          interface: iface,
        },
        entries: filtered.map((entry: any) => ({
          address: entry.address,
          mac_address: entry['mac-address'],
          interface: entry.interface,
          complete: entry.complete || false,
          dynamic: entry.dynamic || false,
        })),
        count: filtered.length,
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }

  private async queryDns(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const hostname = (params.hostname || params.address) as string;

    if (!hostname) {
      return this.error('hostname or address parameter required for DNS lookup');
    }

    const insights: string[] = [`Resolving hostname: ${hostname}`];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      // Execute DNS resolve
      const dnsResults = await mikrotikService.executeCommand('/tool/dns/resolve', {
        name: hostname,
      });

      if (!dnsResults || dnsResults.length === 0) {
        warnings.push(`DNS resolution failed for ${hostname}`);
        recommendations.push('Verify DNS server is configured and reachable');
        recommendations.push('Check if hostname exists in DNS');
        recommendations.push('Try pinging DNS server directly to test connectivity');

        const executionTime = Date.now() - startTime;
        return this.success(
          {
            action: 'dns',
            hostname,
            resolved: false,
            addresses: [],
            insights,
            warnings,
            recommendations,
            timestamp: new Date().toISOString(),
          },
          executionTime
        );
      }

      const addresses = dnsResults
        .filter((r: any) => r.address)
        .map((r: any) => r.address);

      if (addresses.length > 0) {
        insights.push(`Resolved to ${addresses.length} address(es): ${addresses.join(', ')}`);
      }

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          action: 'dns',
          hostname,
          resolved: true,
          addresses,
          insights,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    } catch (error) {
      warnings.push(`DNS resolution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      recommendations.push('Check DNS server configuration in /ip dns');
      recommendations.push('Verify network connectivity to DNS server');

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          action: 'dns',
          hostname,
          resolved: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          insights,
          warnings,
          recommendations,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    }
  }

  private async queryDhcp(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const targetIp = params.address as string | undefined;
    const iface = params.interface as string | undefined;

    // Get DHCP leases
    const dhcpLeases = await mikrotikService.getDhcpLeases();

    // Filter leases
    let filtered = dhcpLeases.filter((lease: any) => !lease.disabled);

    if (targetIp) {
      filtered = filtered.filter((lease: any) => lease.address === targetIp);
    }

    if (iface) {
      filtered = filtered.filter((lease: any) => lease.interface === iface);
    }

    // Build insights
    const insights: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (targetIp) {
      insights.push(`Searching DHCP leases for ${targetIp}`);
    } else {
      insights.push(`Retrieved ${filtered.length} active DHCP leases`);
    }

    if (filtered.length === 0) {
      if (targetIp) {
        warnings.push(`No DHCP lease found for ${targetIp}`);
        recommendations.push('Host may be using static IP or different DHCP server');
        recommendations.push('Check if IP is within DHCP pool range');
      } else {
        insights.push('No active DHCP leases found');
      }
    } else if (targetIp && filtered.length === 1) {
      const lease = filtered[0];
      insights.push(`Found DHCP lease for ${lease.address}`);
      insights.push(`MAC address: ${lease['mac-address']}`);
      insights.push(`Hostname: ${lease['host-name'] || 'Unknown'}`);
      insights.push(`Status: ${lease.status || 'Unknown'}`);

      if (lease.blocked) {
        warnings.push('DHCP lease is blocked');
        recommendations.push('Check DHCP server configuration for blocked hosts');
      }
    }

    // Statistics
    if (!targetIp) {
      const bound = filtered.filter((l: any) => l.status === 'bound').length;
      const waiting = filtered.filter((l: any) => l.status === 'waiting').length;

      insights.push(`Lease status: ${bound} bound, ${waiting} waiting`);
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'dhcp',
        filter: {
          address: targetIp,
          interface: iface,
        },
        leases: filtered.map((lease: any) => ({
          address: lease.address,
          mac_address: lease['mac-address'],
          hostname: lease['host-name'],
          interface: lease.interface,
          status: lease.status,
          expires_after: lease['expires-after'],
          blocked: lease.blocked || false,
        })),
        count: filtered.length,
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }

  private async queryAddresses(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const targetIp = params.address as string | undefined;
    const iface = params.interface as string | undefined;

    // Get IP addresses
    const ipAddresses = await mikrotikService.getIpAddresses();

    // Filter addresses
    let filtered = ipAddresses.filter((addr: any) => !addr.disabled && !addr.invalid);

    if (targetIp) {
      filtered = filtered.filter((addr: any) => {
        const address = addr.address?.split('/')[0];
        return address === targetIp;
      });
    }

    if (iface) {
      filtered = filtered.filter((addr: any) => addr.interface === iface);
    }

    // Build insights
    const insights: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (targetIp) {
      insights.push(`Searching for IP address ${targetIp}`);
    } else {
      insights.push(`Retrieved ${filtered.length} configured IP addresses`);
    }

    if (filtered.length === 0) {
      if (targetIp) {
        warnings.push(`IP address ${targetIp} not found in configuration`);
        recommendations.push('Verify IP address is correctly configured on router');
      } else if (iface) {
        warnings.push(`No IP addresses configured on interface ${iface}`);
        recommendations.push('Configure an IP address on this interface');
      }
    }

    // Group by interface
    const byInterface = new Map<string, number>();
    filtered.forEach((addr: any) => {
      const iface = addr.interface;
      byInterface.set(iface, (byInterface.get(iface) || 0) + 1);
    });

    if (!targetIp && !iface) {
      insights.push('Addresses by interface:');
      byInterface.forEach((count, ifaceName) => {
        insights.push(`  ${ifaceName}: ${count} address(es)`);
      });
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'addresses',
        filter: {
          address: targetIp,
          interface: iface,
        },
        addresses: filtered.map((addr: any) => ({
          address: addr.address,
          network: addr.network,
          interface: addr.interface,
          dynamic: addr.dynamic || false,
          comment: addr.comment,
        })),
        count: filtered.length,
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }
}
