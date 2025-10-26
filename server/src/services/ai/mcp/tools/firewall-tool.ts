/**
 * Firewall Tool - Enhanced with Intelligent Analysis
 *
 * Provides:
 * - Firewall filter rules listing
 * - Intelligent path analysis (why is traffic blocked?)
 * - NAT rules inspection
 * - Connection tracking
 * - Actionable recommendations with confidence scores
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

// Network parsing utilities
function matchesAddress(testIp: string, addressPattern: string): boolean {
  if (!addressPattern) return true; // No pattern = matches all

  // Exact match
  if (addressPattern === testIp) return true;

  // Negated match (e.g., "!192.168.1.0/24")
  if (addressPattern.startsWith('!')) {
    const pattern = addressPattern.substring(1);
    return !matchesAddress(testIp, pattern);
  }

  // CIDR match
  if (addressPattern.includes('/')) {
    return ipInCIDR(testIp, addressPattern);
  }

  return false;
}

function ipInCIDR(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const mask = ~((1 << (32 - prefix)) - 1);

  return (ipNum & mask) === (networkNum & mask);
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function matchesPort(testPort: number, portPattern: string | undefined): boolean {
  if (!portPattern) return true; // No pattern = matches all

  // Port range (e.g., "80-443")
  if (portPattern.includes('-')) {
    const [start, end] = portPattern.split('-').map(p => parseInt(p, 10));
    if (!isNaN(start) && !isNaN(end)) {
      return testPort >= start && testPort <= end;
    }
  }

  // Port list (e.g., "80,443,8080")
  if (portPattern.includes(',')) {
    const ports = portPattern.split(',').map(p => parseInt(p.trim(), 10));
    return ports.includes(testPort);
  }

  // Single port
  const port = parseInt(portPattern, 10);
  return !isNaN(port) && testPort === port;
}

const SERVICE_PORTS: Record<string, number> = {
  http: 80,
  https: 443,
  ssh: 22,
  ftp: 21,
  telnet: 23,
  smtp: 25,
  dns: 53,
  dhcp: 67,
  pop3: 110,
  imap: 143,
  snmp: 161,
  rdp: 3389,
  mysql: 3306,
  postgresql: 5432,
};

export class FirewallTool extends BaseMCPTool {
  readonly name = 'analyze_firewall';
  readonly description =
    'Analyze firewall rules to diagnose connectivity issues. Can list rules, analyze if specific traffic is allowed/blocked, check NAT configuration. Use this when troubleshooting "why can\'t host X access host Y?" questions. The analyze_path action identifies the exact blocking rule with high confidence.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform: list rules, analyze connectivity path, or list NAT rules',
        enum: ['list_rules', 'analyze_path', 'list_nat'],
      },
      chain: {
        type: 'string',
        description: 'Firewall chain to check (for list_rules or analyze_path). Defaults to "forward" for network-to-network traffic',
        enum: ['input', 'forward', 'output'],
      },
      src_address: {
        type: 'string',
        description: 'Source IP address (required for analyze_path)',
      },
      dst_address: {
        type: 'string',
        description: 'Destination IP address (required for analyze_path)',
      },
      port: {
        type: 'number',
        description: 'Destination port number (for analyze_path)',
      },
      service: {
        type: 'string',
        description: 'Service name like http, https, ssh (alternative to port)',
      },
      protocol: {
        type: 'string',
        description: 'Protocol for analyze_path. Defaults to tcp',
        enum: ['tcp', 'udp', 'icmp'],
      },
    },
    required: [],
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

      const action = (params.action as string) || 'list_rules';

      switch (action) {
        case 'list_rules':
          return await this.listRules(params, startTime);
        case 'analyze_path':
          return await this.analyzePath(params, startTime);
        case 'list_nat':
          return await this.listNAT(params, startTime);
        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Firewall analysis failed',
        executionTime
      );
    }
  }

  private async listRules(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const rules = await mikrotikService.getFirewallFilterRules();
    const chain = params.chain as string | undefined;

    // Filter by chain if specified
    const filteredRules = chain ? rules.filter(r => r.chain === chain) : rules;

    // Filter out disabled/invalid rules
    const activeRules = filteredRules.filter(r => !r.disabled && !r.invalid);

    // Statistics
    const byAction = {
      accept: activeRules.filter(r => r.action === 'accept').length,
      drop: activeRules.filter(r => r.action === 'drop').length,
      reject: activeRules.filter(r => r.action === 'reject').length,
      other: activeRules.filter(r => !['accept', 'drop', 'reject'].includes(r.action)).length,
    };

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        rules: activeRules,
        count: activeRules.length,
        statistics: {
          total: activeRules.length,
          by_action: byAction,
          chain_filter: chain || 'all',
        },
        insights: [
          `Found ${activeRules.length} active firewall rules${chain ? ` in ${chain} chain` : ''}`,
          `Actions: ${byAction.accept} accept, ${byAction.drop} drop, ${byAction.reject} reject`,
        ],
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }

  private async analyzePath(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    // Validate required parameters
    const srcAddress = params.src_address as string;
    const dstAddress = params.dst_address as string;

    if (!srcAddress || !dstAddress) {
      return this.error('analyze_path requires src_address and dst_address');
    }

    // Determine port
    let port: number | undefined;
    if (params.port) {
      port = params.port as number;
    } else if (params.service) {
      port = SERVICE_PORTS[(params.service as string).toLowerCase()];
      if (!port) {
        return this.error(`Unknown service: ${params.service}`);
      }
    }

    const protocol = (params.protocol as string) || 'tcp';
    const chain = (params.chain as string) || 'forward';

    // Fetch all firewall rules
    const allRules = await mikrotikService.getFirewallFilterRules();

    // Filter to active rules in the relevant chain
    const chainRules = allRules.filter(r => r.chain === chain && !r.disabled && !r.invalid);

    // Analyze which rules match this traffic
    const matchingRules: Array<{
      rule: any;
      matchReason: string;
      verdict: 'allow' | 'block' | 'partial';
    }> = [];

    for (const rule of chainRules) {
      const matchReasons: string[] = [];
      let matches = true;

      // Check protocol
      if (rule.protocol && rule.protocol !== protocol) {
        matches = false;
      } else if (rule.protocol) {
        matchReasons.push(`protocol=${protocol}`);
      }

      // Check source address
      if (matches && rule.srcAddress) {
        if (matchesAddress(srcAddress, rule.srcAddress)) {
          matchReasons.push(`src=${rule.srcAddress}`);
        } else {
          matches = false;
        }
      }

      // Check destination address
      if (matches && rule.dstAddress) {
        if (matchesAddress(dstAddress, rule.dstAddress)) {
          matchReasons.push(`dst=${rule.dstAddress}`);
        } else {
          matches = false;
        }
      }

      // Check destination port
      if (matches && port !== undefined && rule.dstPort) {
        if (matchesPort(port, rule.dstPort)) {
          matchReasons.push(`dst-port=${rule.dstPort}`);
        } else {
          matches = false;
        }
      }

      if (matches) {
        const verdict: 'allow' | 'block' | 'partial' =
          rule.action === 'accept' ? 'allow' :
          rule.action === 'drop' || rule.action === 'reject' ? 'block' :
          'partial';

        matchingRules.push({
          rule,
          matchReason: matchReasons.length > 0 ? matchReasons.join(', ') : 'default match',
          verdict,
        });

        // First terminal match wins
        if (verdict !== 'partial') {
          break;
        }
      }
    }

    // Determine final verdict
    let allowed = false;
    let blockingRule: any = undefined;
    let reason = '';
    let confidence: 'high' | 'medium' | 'low' = 'high';

    if (matchingRules.length === 0) {
      allowed = false;
      reason = 'No explicit rule matches - default policy likely drops traffic';
      confidence = 'medium';
    } else {
      const firstMatch = matchingRules[0];
      if (firstMatch.verdict === 'allow') {
        allowed = true;
        reason = `Rule #${firstMatch.rule.id} explicitly accepts this traffic`;
      } else if (firstMatch.verdict === 'block') {
        allowed = false;
        blockingRule = firstMatch.rule;
        reason = `Rule #${firstMatch.rule.id} blocks this traffic (action: ${firstMatch.rule.action})`;
      } else {
        allowed = false;
        reason = 'Rules match but no explicit accept/drop found';
        confidence = 'low';
      }
    }

    // Build insights and recommendations
    const insights: string[] = [
      `Analyzing: ${srcAddress} → ${dstAddress}${port ? ':' + port : ''} (${protocol})`,
      `Checking ${chain} chain with ${chainRules.length} active rules`,
      `Found ${matchingRules.length} matching rules`,
    ];

    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (!allowed) {
      warnings.push(`Traffic is BLOCKED: ${reason}`);
      if (blockingRule) {
        warnings.push(
          `Blocking rule #${blockingRule.id}: ${blockingRule.action} ${blockingRule.comment ? '(' + blockingRule.comment + ')' : ''}`
        );
        recommendations.push(`Consider adding an ACCEPT rule before rule #${blockingRule.id} for this specific traffic`);
        recommendations.push(`Or modify rule #${blockingRule.id} to allow this connection`);
      } else {
        recommendations.push(`Add an explicit ACCEPT rule to the ${chain} chain for this traffic`);
      }
    } else {
      insights.push(`Traffic appears ALLOWED: ${reason}`);
    }

    // Add details about matching rules
    if (matchingRules.length > 0) {
      insights.push('\nMatching rules in order:');
      matchingRules.forEach((match, idx) => {
        insights.push(
          `  ${idx + 1}. Rule #${match.rule.id}: ${match.rule.action.toUpperCase()} - ${match.matchReason}`
        );
      });
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        verdict: {
          allowed,
          blocking_rule: blockingRule,
          reason,
          confidence,
        },
        analysis: {
          src_address: srcAddress,
          dst_address: dstAddress,
          port,
          protocol,
          chain,
        },
        matching_rules: matchingRules.map(m => ({
          id: m.rule.id,
          chain: m.rule.chain,
          action: m.rule.action,
          match_reason: m.matchReason,
          verdict: m.verdict,
          comment: m.rule.comment,
        })),
        insights,
        warnings: warnings.length > 0 ? warnings : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }

  private async listNAT(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const natRules = await mikrotikService.getFirewallNatRules();

    // Filter out disabled/invalid rules
    const activeRules = natRules.filter(r => !r.disabled && !r.invalid);

    const byChain = {
      srcnat: activeRules.filter(r => r.chain === 'srcnat').length,
      dstnat: activeRules.filter(r => r.chain === 'dstnat').length,
    };

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        nat_rules: activeRules,
        count: activeRules.length,
        statistics: {
          total: activeRules.length,
          by_chain: byChain,
        },
        insights: [
          `Found ${activeRules.length} active NAT rules`,
          `Source NAT: ${byChain.srcnat} rules, Destination NAT: ${byChain.dstnat} rules`,
        ],
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }
}
