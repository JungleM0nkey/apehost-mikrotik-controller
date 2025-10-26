/**
 * Connectivity Tool - Active Network Testing
 *
 * Provides:
 * - ICMP ping testing with packet loss and latency analysis
 * - Traceroute path discovery
 * - Bandwidth testing capabilities
 * - Connection quality assessment
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class ConnectivityTool extends BaseMCPTool {
  readonly name = 'test_connectivity';
  readonly description =
    'Test network connectivity to troubleshoot reachability issues. Can ping hosts, trace routing paths, or test bandwidth. Use this when diagnosing "can\'t reach host" or "slow connection" issues. The ping action provides latency and packet loss metrics.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Test to perform: ping for reachability, traceroute for path discovery, bandwidth-test for throughput',
        enum: ['ping', 'traceroute', 'bandwidth-test'],
      },
      address: {
        type: 'string',
        description: 'Target IP address or hostname to test (required for all actions)',
      },
      count: {
        type: 'number',
        description: 'Number of ping packets or hops (default: 4 for ping, 30 for traceroute)',
      },
      size: {
        type: 'number',
        description: 'Packet size in bytes (default: 64)',
      },
      interval: {
        type: 'string',
        description: 'Interval between packets (e.g., "1s", "100ms"). Default: 1s',
      },
      interface: {
        type: 'string',
        description: 'Source interface to use for testing (optional)',
      },
      protocol: {
        type: 'string',
        description: 'Protocol for bandwidth test (tcp or udp). Default: tcp',
        enum: ['tcp', 'udp'],
      },
      direction: {
        type: 'string',
        description: 'Traffic direction for bandwidth test (send, receive, or both). Default: both',
        enum: ['send', 'receive', 'both'],
      },
    },
    required: ['action', 'address'],
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
        case 'ping':
          return await this.performPing(params, startTime);
        case 'traceroute':
          return await this.performTraceroute(params, startTime);
        case 'bandwidth-test':
          return await this.performBandwidthTest(params, startTime);
        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Connectivity test failed',
        executionTime
      );
    }
  }

  private async performPing(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const address = params.address as string;
    const count = (params.count as number) || 4;
    const size = params.size as number | undefined;
    const interval = params.interval as string | undefined;
    const iface = params.interface as string | undefined;

    // Build ping parameters
    const pingParams: Record<string, any> = {
      address,
      count: Math.min(count, 10), // Limit to 10 packets
    };

    if (size) pingParams.size = size;
    if (interval) pingParams.interval = interval;
    if (iface) pingParams.interface = iface;

    // Execute ping
    const pingResults = await mikrotikService.executeCommand('/ping', pingParams);

    // Parse results
    const responses = pingResults.filter((r: any) => r.time || r.timeout);
    const successful = responses.filter((r: any) => r.time && !r.timeout);
    const failed = responses.filter((r: any) => r.timeout);

    // Calculate statistics
    const packetLoss = responses.length > 0
      ? Math.round((failed.length / responses.length) * 100)
      : 100;

    const latencies = successful
      .map((r: any) => {
        const timeStr = r.time?.replace('ms', '') || '0';
        return parseFloat(timeStr);
      })
      .filter((t: number) => !isNaN(t) && t > 0);

    const avgLatency = latencies.length > 0
      ? Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10
      : 0;

    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    // Build insights
    const insights: string[] = [
      `Pinging ${address} with ${count} packets`,
      `Packet loss: ${packetLoss}%`,
    ];

    if (avgLatency > 0) {
      insights.push(`Average latency: ${avgLatency}ms`);
      insights.push(`Min/Max latency: ${minLatency}ms / ${maxLatency}ms`);
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Quality assessment
    let quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unreachable';
    if (packetLoss === 100) {
      quality = 'unreachable';
      warnings.push('Host is completely unreachable - no responses received');
      recommendations.push('Check if host is online and network path is correct');
      recommendations.push('Verify firewall rules allow ICMP traffic');
      recommendations.push('Use traceroute to identify where packets are being dropped');
    } else if (packetLoss > 20) {
      quality = 'poor';
      warnings.push(`High packet loss (${packetLoss}%) indicates network instability`);
      recommendations.push('Check for network congestion or failing hardware');
      recommendations.push('Verify physical connections and interface status');
    } else if (packetLoss > 5) {
      quality = 'fair';
      warnings.push(`Moderate packet loss (${packetLoss}%) detected`);
      recommendations.push('Monitor for intermittent connectivity issues');
    } else if (avgLatency > 100) {
      quality = 'fair';
      warnings.push(`High latency (${avgLatency}ms) may affect application performance`);
      recommendations.push('Check for network congestion or routing issues');
    } else if (avgLatency > 50) {
      quality = 'good';
      insights.push('Latency is acceptable but could be improved');
    } else {
      quality = 'excellent';
      insights.push('Connection quality is excellent');
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'ping',
        target: address,
        statistics: {
          packets_sent: count,
          packets_received: successful.length,
          packet_loss_percent: packetLoss,
          latency_avg_ms: avgLatency,
          latency_min_ms: minLatency,
          latency_max_ms: maxLatency,
        },
        quality,
        results: responses.map((r: any) => ({
          seq: r.seq,
          time: r.time,
          ttl: r.ttl,
          timeout: r.timeout || false,
        })),
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }

  private async performTraceroute(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const address = params.address as string;
    const count = (params.count as number) || 30;
    const iface = params.interface as string | undefined;

    // Build traceroute parameters
    const traceParams: Record<string, any> = {
      address,
      count: Math.min(count, 30), // Limit to 30 hops
    };

    if (iface) traceParams.interface = iface;

    // Execute traceroute
    const traceResults = await mikrotikService.executeCommand('/tool/traceroute', traceParams);

    // Parse hop results
    const hops = traceResults
      .filter((r: any) => r.address || r.timeout)
      .map((r: any, index: number) => ({
        hop: index + 1,
        address: r.address || 'timeout',
        hostname: r.host,
        time: r.time,
        timeout: r.timeout || false,
        loss: r.loss,
      }));

    const reachedTarget = hops.some(h => h.address === address);
    const maxHopReached = hops.length;

    // Build insights
    const insights: string[] = [
      `Tracing route to ${address}`,
      `Maximum hops: ${maxHopReached}`,
    ];

    if (reachedTarget) {
      insights.push(`Successfully reached target in ${maxHopReached} hops`);
    } else {
      insights.push('Did not reach target - path may be incomplete');
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Analyze path
    const timeouts = hops.filter(h => h.timeout).length;
    if (timeouts > 0) {
      warnings.push(`${timeouts} hop(s) timed out - may indicate filtering or congestion`);
    }

    if (!reachedTarget) {
      warnings.push('Traceroute did not reach the target');
      recommendations.push('Check if target host is online and allows ICMP time-exceeded messages');
      recommendations.push('Verify routing configuration for this destination');
      recommendations.push('Some hops may filter ICMP - timeouts don\'t always indicate a problem');
    }

    // Check for routing loops
    const addresses = hops.filter(h => !h.timeout).map(h => h.address);
    const uniqueAddresses = new Set(addresses);
    if (addresses.length !== uniqueAddresses.size) {
      warnings.push('Possible routing loop detected - same address appears multiple times');
      recommendations.push('Check routing table for circular routes');
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'traceroute',
        target: address,
        path_complete: reachedTarget,
        total_hops: maxHopReached,
        hops,
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }

  private async performBandwidthTest(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const address = params.address as string;
    const protocol = (params.protocol as string) || 'tcp';
    const direction = (params.direction as string) || 'both';

    // Build bandwidth test parameters
    const bwParams: Record<string, any> = {
      address,
      protocol,
      direction,
      duration: '10s', // Fixed 10-second test
    };

    // Execute bandwidth test
    const bwResults = await mikrotikService.executeCommand('/tool/bandwidth-test', bwParams);

    // Parse results (last result contains final statistics)
    const finalResult = bwResults[bwResults.length - 1] || {};

    const txSpeed = this.parseSpeed(finalResult['tx-current'] || finalResult['tx-total-average']);
    const rxSpeed = this.parseSpeed(finalResult['rx-current'] || finalResult['rx-total-average']);

    // Build insights
    const insights: string[] = [
      `Bandwidth test to ${address} using ${protocol.toUpperCase()}`,
      `Direction: ${direction}`,
    ];

    if (direction === 'send' || direction === 'both') {
      insights.push(`Upload speed: ${this.formatSpeed(txSpeed)}`);
    }

    if (direction === 'receive' || direction === 'both') {
      insights.push(`Download speed: ${this.formatSpeed(rxSpeed)}`);
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Assess results
    if (txSpeed === 0 && rxSpeed === 0) {
      warnings.push('Bandwidth test failed - no data transferred');
      recommendations.push('Verify target host is online and bandwidth-server is running');
      recommendations.push('Check firewall rules allow bandwidth-test traffic');
    } else if (txSpeed < 1000000 || rxSpeed < 1000000) {
      // Less than 1 Mbps
      warnings.push('Very low bandwidth detected - may indicate network issues');
      recommendations.push('Check for network congestion or bandwidth limitations');
      recommendations.push('Verify interface speed settings are correct');
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'bandwidth-test',
        target: address,
        protocol,
        direction,
        results: {
          tx_speed_bps: txSpeed,
          rx_speed_bps: rxSpeed,
          tx_speed_formatted: this.formatSpeed(txSpeed),
          rx_speed_formatted: this.formatSpeed(rxSpeed),
        },
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }

  /**
   * Parse speed from RouterOS format (e.g., "10.5Mbps" → 10500000)
   */
  private parseSpeed(speedStr: string | undefined): number {
    if (!speedStr) return 0;

    const match = speedStr.match(/([\d.]+)\s*([KMGT]?bps)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers: Record<string, number> = {
      'bps': 1,
      'kbps': 1000,
      'mbps': 1000000,
      'gbps': 1000000000,
      'tbps': 1000000000000,
    };

    return Math.round(value * (multipliers[unit] || 1));
  }

  /**
   * Format speed in bps to human-readable format
   */
  private formatSpeed(bps: number): string {
    if (bps === 0) return '0 bps';

    if (bps < 1000) return `${bps} bps`;
    if (bps < 1000000) return `${(bps / 1000).toFixed(2)} Kbps`;
    if (bps < 1000000000) return `${(bps / 1000000).toFixed(2)} Mbps`;
    return `${(bps / 1000000000).toFixed(2)} Gbps`;
  }
}
