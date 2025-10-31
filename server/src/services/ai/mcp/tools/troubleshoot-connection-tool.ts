/**
 * Troubleshoot Connection Tool - One-Step Connectivity Diagnosis
 *
 * Purpose: Streamlined connectivity troubleshooting that automatically:
 * 1. Tests basic reachability (ping)
 * 2. Analyzes firewall rules for the path
 * 3. Checks routing configuration
 * 4. Provides actionable recommendations
 *
 * This tool eliminates analysis paralysis by executing all diagnostic steps
 * in one call, making it the go-to tool for "why can't X connect to Y" questions.
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class TroubleshootConnectionTool extends BaseMCPTool {
  readonly name = 'troubleshoot_connection';
  readonly description =
    'Automatically diagnose why one host cannot connect to another. Performs comprehensive analysis including ping test, firewall rule checking, and routing verification. Use this for "why can\'t X connect to Y" or "connection refused" questions. Returns root cause and actionable fix recommendations.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      source_ip: {
        type: 'string',
        description: 'Source IP address attempting the connection (e.g., 192.168.100.200)',
      },
      destination_ip: {
        type: 'string',
        description: 'Destination IP address being accessed (e.g., 192.168.30.50)',
      },
      port: {
        type: 'number',
        description: 'Destination port number (optional, helps narrow firewall analysis)',
      },
      protocol: {
        type: 'string',
        description: 'Protocol being used (tcp, udp, icmp). Default: tcp',
        enum: ['tcp', 'udp', 'icmp'],
      },
      service: {
        type: 'string',
        description: 'Service name for common ports (http, https, ssh, rdp, etc.)',
      },
    },
    required: ['source_ip', 'destination_ip'],
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

      const sourceIp = params.source_ip as string;
      const destinationIp = params.destination_ip as string;
      const port = params.port as number | undefined;
      const protocol = (params.protocol as string) || 'tcp';
      const service = params.service as string | undefined;

      const results: any = {
        source: sourceIp,
        destination: destinationIp,
        port,
        protocol,
        service,
        tests: {},
        issues: [],
        recommendations: [],
      };

      // Step 1: Test basic reachability
      console.log(`[TroubleshootConnection] Testing reachability from ${sourceIp} to ${destinationIp}`);
      const pingResult = await this.testReachability(destinationIp);
      results.tests.reachability = pingResult;

      if (!pingResult.reachable) {
        results.issues.push({
          severity: 'critical',
          issue: `Destination ${destinationIp} is not reachable`,
          details: pingResult.error || 'Host is offline or network path is broken',
        });
        results.recommendations.push({
          action: 'Check if destination host is powered on and network cable is connected',
          priority: 'high',
        });
        results.recommendations.push({
          action: `Verify routing: Check if router has a route to ${destinationIp}`,
          command: '/ip route print',
          priority: 'high',
        });
      } else {
        results.tests.reachability.status = 'success';
        results.tests.reachability.latency = `${pingResult.avgLatency}ms`;
      }

      // Step 2: Analyze firewall rules
      console.log(`[TroubleshootConnection] Analyzing firewall rules`);
      const firewallResult = await this.analyzeFirewallRules(sourceIp, destinationIp, port, protocol);
      results.tests.firewall = firewallResult;

      if (firewallResult.blocked) {
        results.issues.push({
          severity: 'critical',
          issue: 'Traffic is blocked by firewall',
          details: `Rule: ${firewallResult.blockingRule?.comment || firewallResult.blockingRule?.chain}`,
          rule: firewallResult.blockingRule,
        });
        results.recommendations.push({
          action: 'Add firewall rule to allow this connection',
          command: `/ip firewall filter add chain=forward src-address=${sourceIp} dst-address=${destinationIp}${port ? ` dst-port=${port}` : ''} protocol=${protocol} action=accept`,
          priority: 'high',
        });
      } else if (firewallResult.allowingRule) {
        results.tests.firewall.status = 'success';
        results.tests.firewall.allowedBy = firewallResult.allowingRule.comment || `Rule #${firewallResult.allowingRule.id}`;
      } else {
        results.tests.firewall.status = 'warning';
        results.tests.firewall.note = 'No explicit allow or deny rule found - default policy applies';
      }

      // Step 3: Check routing
      console.log(`[TroubleshootConnection] Checking routing configuration`);
      const routingResult = await this.checkRouting(destinationIp);
      results.tests.routing = routingResult;

      if (!routingResult.hasRoute) {
        results.issues.push({
          severity: 'critical',
          issue: `No route to destination network ${routingResult.network}`,
          details: 'Router does not have a route to reach this network',
        });
        results.recommendations.push({
          action: `Add static route to ${routingResult.network}`,
          command: `/ip route add dst-address=${routingResult.network} gateway=<GATEWAY_IP>`,
          priority: 'critical',
        });
      } else {
        results.tests.routing.status = 'success';
        results.tests.routing.route = routingResult.route;
      }

      // Step 4: Check if hosts are on same subnet (direct routing vs gateway)
      const sourceNet = this.getNetworkAddress(sourceIp, 24);
      const destNet = this.getNetworkAddress(destinationIp, 24);

      if (sourceNet !== destNet) {
        results.tests.network = {
          status: 'info',
          note: 'Hosts are on different subnets - traffic must pass through router',
          sourceNetwork: sourceNet,
          destinationNetwork: destNet,
        };
        results.recommendations.push({
          action: 'Verify router is properly configured to route between these subnets',
          priority: 'medium',
        });
      } else {
        results.tests.network = {
          status: 'info',
          note: 'Hosts are on the same subnet - should communicate directly',
        };
      }

      // Step 5: Summarize root cause
      if (results.issues.length === 0) {
        results.rootCause = 'No blocking issues detected - connection should work';
        results.summary = `Connection from ${sourceIp} to ${destinationIp}${port ? `:${port}` : ''} appears to be properly configured.`;
      } else {
        const criticalIssues = results.issues.filter((i: any) => i.severity === 'critical');
        results.rootCause = criticalIssues.length > 0
          ? criticalIssues[0].issue
          : results.issues[0].issue;
        results.summary = `Connection blocked: ${results.rootCause}`;
      }

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          ...results,
          timestamp: new Date().toISOString(),
          executionTime: `${executionTime}ms`,
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Connection troubleshooting failed',
        executionTime
      );
    }
  }

  /**
   * Test basic reachability with ping
   */
  private async testReachability(address: string): Promise<any> {
    try {
      const pingResult = await mikrotikService.executeCommand('/ping', {
        address,
        count: 4,
      });

      if (!pingResult || pingResult.length === 0) {
        return {
          reachable: false,
          error: 'Ping failed - no response from host',
        };
      }

      // Calculate average latency
      const successfulPings = pingResult.filter((r: any) => r.time);
      if (successfulPings.length === 0) {
        return {
          reachable: false,
          error: 'All ping packets lost',
          packetLoss: '100%',
        };
      }

      const avgLatency = successfulPings.reduce((sum: number, r: any) => {
        const timeStr = r.time.replace('ms', '');
        return sum + parseFloat(timeStr);
      }, 0) / successfulPings.length;

      const packetLoss = ((4 - successfulPings.length) / 4) * 100;

      return {
        reachable: true,
        avgLatency: Math.round(avgLatency * 10) / 10,
        packetLoss: `${packetLoss}%`,
        packets: {
          sent: 4,
          received: successfulPings.length,
        },
      };
    } catch (error) {
      return {
        reachable: false,
        error: error instanceof Error ? error.message : 'Ping test failed',
      };
    }
  }

  /**
   * Analyze firewall rules for the connection path
   */
  private async analyzeFirewallRules(
    sourceIp: string,
    destinationIp: string,
    port: number | undefined,
    protocol: string
  ): Promise<any> {
    try {
      const filterRules = await mikrotikService.getFirewallFilterRules();

      // Look for rules that match this traffic
      const matchingRules = filterRules.filter((rule: any) => {
        if (rule.disabled) return false;

        // Check chain (forward for routed traffic, input for router itself)
        if (rule.chain !== 'forward' && rule.chain !== 'input') return false;

        // Check protocol
        if (rule.protocol && rule.protocol !== protocol) return false;

        // Check source address
        if (rule.srcAddress && !this.matchesAddress(sourceIp, rule.srcAddress)) return false;

        // Check destination address
        if (rule.dstAddress && !this.matchesAddress(destinationIp, rule.dstAddress)) return false;

        // Check port
        if (port && rule.dstPort && !this.matchesPort(port, rule.dstPort)) return false;

        return true;
      });

      // Find first blocking rule
      const blockingRule = matchingRules.find((r: any) => r.action === 'drop' || r.action === 'reject');
      if (blockingRule) {
        return {
          blocked: true,
          blockingRule: {
            id: blockingRule.id,
            chain: blockingRule.chain,
            action: blockingRule.action,
            comment: blockingRule.comment,
            srcAddress: blockingRule.srcAddress,
            dstAddress: blockingRule.dstAddress,
            dstPort: blockingRule.dstPort,
          },
        };
      }

      // Find first allowing rule
      const allowingRule = matchingRules.find((r: any) => r.action === 'accept');
      if (allowingRule) {
        return {
          blocked: false,
          allowingRule: {
            id: allowingRule.id,
            chain: allowingRule.chain,
            action: allowingRule.action,
            comment: allowingRule.comment,
          },
        };
      }

      return {
        blocked: false,
        note: 'No explicit rule found - default policy applies',
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to analyze firewall rules',
      };
    }
  }

  /**
   * Check if router has a route to the destination
   */
  private async checkRouting(destinationIp: string): Promise<any> {
    try {
      const routes = await mikrotikService.getRoutes();

      // Find route that matches this destination
      const matchingRoute = routes.find((route: any) => {
        if (!route.active) return false;
        return this.ipInNetwork(destinationIp, route.dstAddress);
      });

      if (matchingRoute) {
        return {
          hasRoute: true,
          route: {
            destination: matchingRoute.dstAddress,
            gateway: matchingRoute.gateway,
            interface: matchingRoute.interface,
            distance: matchingRoute.distance,
          },
        };
      }

      // Determine network address
      const network = this.getNetworkAddress(destinationIp, 24);

      return {
        hasRoute: false,
        network: `${network}/24`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to check routing',
      };
    }
  }

  /**
   * Check if IP matches address pattern (CIDR, negation, etc.)
   */
  private matchesAddress(testIp: string, pattern: string): boolean {
    if (!pattern) return true;
    if (pattern === testIp) return true;

    if (pattern.startsWith('!')) {
      return !this.matchesAddress(testIp, pattern.substring(1));
    }

    if (pattern.includes('/')) {
      return this.ipInNetwork(testIp, pattern);
    }

    return false;
  }

  /**
   * Check if IP is in CIDR network
   */
  private ipInNetwork(ip: string, cidr: string): boolean {
    const [network, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);

    if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

    const ipNum = this.ipToNumber(ip);
    const networkNum = this.ipToNumber(network);
    const mask = ~((1 << (32 - prefix)) - 1);

    return (ipNum & mask) === (networkNum & mask);
  }

  /**
   * Convert IP to number
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Get network address from IP and prefix
   */
  private getNetworkAddress(ip: string, prefix: number): string {
    const ipNum = this.ipToNumber(ip);
    const mask = ~((1 << (32 - prefix)) - 1);
    const networkNum = (ipNum & mask) >>> 0;

    return [
      (networkNum >>> 24) & 255,
      (networkNum >>> 16) & 255,
      (networkNum >>> 8) & 255,
      networkNum & 255,
    ].join('.');
  }

  /**
   * Check if port matches pattern
   */
  private matchesPort(testPort: number, portPattern: string): boolean {
    if (!portPattern) return true;

    // Port range
    if (portPattern.includes('-')) {
      const [start, end] = portPattern.split('-').map(p => parseInt(p, 10));
      return testPort >= start && testPort <= end;
    }

    // Port list
    if (portPattern.includes(',')) {
      const ports = portPattern.split(',').map(p => parseInt(p.trim(), 10));
      return ports.includes(testPort);
    }

    // Single port
    return testPort === parseInt(portPattern, 10);
  }
}
