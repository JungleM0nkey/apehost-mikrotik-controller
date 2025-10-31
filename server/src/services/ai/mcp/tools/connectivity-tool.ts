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
    'Test network connectivity to troubleshoot reachability and performance issues. Actions: (1) ping - test reachability and latency, (2) traceroute - diagnose WHERE latency or packet loss occurs by showing hop-by-hop path, (3) bandwidth-test - test MikroTik-to-MikroTik throughput (requires bandwidth-server on target), (4) internet-speed-test - test public internet speed. Use traceroute immediately when investigating high latency or packet loss to identify which network segment is causing the issue. Use internet-speed-test for overall internet performance.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Test to perform: ping for basic reachability/latency, traceroute for diagnosing HIGH LATENCY or packet loss (shows which hop is slow), bandwidth-test for MikroTik-to-MikroTik throughput, internet-speed-test for public internet speed',
        enum: ['ping', 'traceroute', 'bandwidth-test', 'internet-speed-test'],
      },
      address: {
        type: 'string',
        description: 'Target IP address or hostname to test (required for ping/traceroute/bandwidth-test; optional for internet-speed-test)',
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
        case 'internet-speed-test':
          return await this.performInternetSpeedTest(params, startTime);
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

    // Analyze latency increases at each hop
    const hopsWithTime = hops.filter(h => h.time && !h.timeout);
    if (hopsWithTime.length >= 2) {
      const latencyIncreases: Array<{ hop: number; address: string; increase: number; total: number }> = [];

      for (let i = 1; i < hopsWithTime.length; i++) {
        const prevTime = parseFloat(hopsWithTime[i - 1].time?.replace('ms', '') || '0');
        const currTime = parseFloat(hopsWithTime[i].time?.replace('ms', '') || '0');
        const increase = currTime - prevTime;

        if (increase > 50) { // Significant latency increase (>50ms)
          latencyIncreases.push({
            hop: hopsWithTime[i].hop,
            address: hopsWithTime[i].address,
            increase: Math.round(increase),
            total: Math.round(currTime),
          });
        }
      }

      // Report significant latency increases
      if (latencyIncreases.length > 0) {
        insights.push('Latency analysis:');
        latencyIncreases.forEach(item => {
          const hopInfo = item.address !== 'timeout' ? `hop ${item.hop} (${item.address})` : `hop ${item.hop}`;
          insights.push(`  • ${hopInfo}: +${item.increase}ms increase (total: ${item.total}ms)`);
        });

        // Identify the worst hop
        const worstHop = latencyIncreases.reduce((max, curr) =>
          curr.increase > max.increase ? curr : max
        );
        warnings.push(`Highest latency increase at hop ${worstHop.hop} (${worstHop.address}): +${worstHop.increase}ms`);

        // Give actionable recommendations based on hop position
        if (worstHop.hop <= 3) {
          recommendations.push('High latency in first few hops suggests local network or ISP gateway issue');
          recommendations.push('Check your router, modem, and ISP connection quality');
        } else if (worstHop.hop > maxHopReached - 3) {
          recommendations.push('High latency near destination suggests issue with target network or server');
          recommendations.push('The target host or its network may be congested');
        } else {
          recommendations.push(`High latency at hop ${worstHop.hop} suggests intermediate network congestion`);
          recommendations.push('This is typically outside your control - may be ISP backbone or peer routing');
        }
      } else {
        insights.push('Latency increases are consistent across all hops (no major bottleneck detected)');
      }

      // Check for overall high latency
      const finalTime = parseFloat(hopsWithTime[hopsWithTime.length - 1].time?.replace('ms', '') || '0');
      if (finalTime > 200) {
        warnings.push(`High total latency: ${Math.round(finalTime)}ms`);
        recommendations.push('Consider testing to different targets to determine if issue is route-specific');
      }
    }

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

  private async performInternetSpeedTest(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    // Test server defaults - can be overridden with address parameter
    const testServer = (params.address as string) || '1.1.1.1'; // Cloudflare DNS
    const testUrl = 'https://speed.cloudflare.com/__down?bytes=25000000'; // 25MB download test

    const insights: string[] = [
      'Internet speed test in progress',
      `Test server: ${testServer}`,
    ];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Test 1: Latency with ping
    let latency = 0;
    try {
      const pingResult = await mikrotikService.executeCommand('/ping', {
        address: testServer,
        count: 4
      });

      if (pingResult && pingResult.length > 0) {
        // Calculate average latency from ping results
        const times = pingResult
          .filter((r: any) => r.time && !r.timeout)
          .map((r: any) => {
            const timeStr = r.time.replace('ms', '');
            return parseFloat(timeStr);
          })
          .filter((t: number) => !isNaN(t) && t > 0);

        if (times.length > 0) {
          latency = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
          insights.push(`Latency: ${latency}ms`);
        } else {
          warnings.push('Unable to measure latency - no successful ping responses');
        }
      }
    } catch (error) {
      warnings.push('Latency test failed - ping command error');
      console.warn('Ping test failed:', error);
    }

    // Test 2: Download speed with fetch
    let downloadSpeed = 0;
    try {
      const fetchStartTime = Date.now();

      await mikrotikService.executeCommand('/tool/fetch', {
        url: testUrl,
        mode: 'https',
        'keep-result': 'no'
      });

      const duration = (Date.now() - fetchStartTime) / 1000; // seconds
      const fileSizeMB = 25; // 25MB
      downloadSpeed = Math.round((fileSizeMB * 8 / duration) * 100) / 100; // Mbps

      insights.push(`Download speed: ${downloadSpeed.toFixed(2)} Mbps`);
    } catch (error) {
      warnings.push('Download speed test failed - fetch command error');
      console.warn('Download test failed:', error);
    }

    // Quality assessment and recommendations
    if (latency === 0 && downloadSpeed === 0) {
      warnings.push('Internet speed test completely failed');
      recommendations.push('Check internet connectivity and verify router has working internet connection');
      recommendations.push('Verify firewall rules allow HTTPS traffic');
      recommendations.push('Try testing connectivity with: action=ping, address=1.1.1.1');
    } else {
      // Latency assessment
      if (latency > 0) {
        if (latency < 20) {
          insights.push('Excellent latency for most applications');
        } else if (latency < 50) {
          insights.push('Good latency for general use');
        } else if (latency < 100) {
          warnings.push('Moderate latency - may affect real-time applications');
          recommendations.push('Check for network congestion or routing issues');
        } else if (latency < 200) {
          warnings.push('High latency - will impact gaming and video calls');
          recommendations.push('Investigate router load and internet connection quality');
        } else {
          warnings.push('Very high latency - significant performance degradation');
          recommendations.push('Check for router overload, QoS misconfiguration, or ISP issues');
        }
      }

      // Download speed assessment
      if (downloadSpeed > 0) {
        if (downloadSpeed < 1) {
          warnings.push('Very slow download speed - below 1 Mbps');
          recommendations.push('Check for bandwidth limitations or network congestion');
          recommendations.push('Verify interface speed settings and cable quality');
        } else if (downloadSpeed < 10) {
          warnings.push('Slow download speed - below 10 Mbps');
          recommendations.push('Consider checking for bandwidth-heavy applications');
        } else if (downloadSpeed < 50) {
          insights.push('Moderate download speed suitable for browsing and streaming');
        } else if (downloadSpeed < 100) {
          insights.push('Good download speed for most uses');
        } else {
          insights.push('Excellent download speed');
        }
      }
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        action: 'internet-speed-test',
        test_server: testServer,
        results: {
          latency_ms: latency,
          download_speed_mbps: downloadSpeed,
          test_duration_seconds: Math.round((executionTime / 1000) * 10) / 10,
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
