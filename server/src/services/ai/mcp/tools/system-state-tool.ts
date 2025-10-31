/**
 * System State Snapshot and Comparison Tool
 * Phase 2: Proactive Intelligence
 *
 * Allows AI to capture system state snapshots and compare them to detect changes
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolResult, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';
import { getAgentDatabase } from '../../../agent/database/agent-db.js';

interface SystemSnapshot {
  timestamp: number;
  conversation_id?: string;
  snapshot_id: string;

  // System metrics
  cpu_usage?: number;
  memory_usage?: number;
  uptime?: number;

  // Network state
  interface_count?: number;
  interface_status?: Record<string, string>;

  // Active issues
  active_issues?: Array<{
    id: string;
    severity: string;
    title: string;
  }>;
  issue_count?: number;

  // Connection state
  dhcp_leases_count?: number;
  connection_count?: number;

  // Firewall state
  firewall_rules_count?: number;
}

export class SystemStateTool extends BaseMCPTool {
  readonly name = 'system_state_snapshot';
  readonly description = `Capture and compare system state snapshots for troubleshooting.

Actions:
- capture: Take a snapshot of current system state (metrics, issues, connections, etc.)
- compare: Compare two snapshots to identify what changed
- list: List recent snapshots for a conversation

Use this tool to:
- Establish baseline state before troubleshooting
- Verify if troubleshooting actions had the intended effect
- Identify what changed between working and non-working states
- Track system state evolution during multi-step troubleshooting`;

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['capture', 'compare', 'list'],
        description: 'The action to perform',
      },
      conversation_id: {
        type: 'string',
        description: 'Conversation ID to associate snapshot with (for capture, list)',
      },
      include_metrics: {
        type: 'boolean',
        description: 'Include system metrics (CPU, memory, uptime) in snapshot (default: true)',
      },
      include_issues: {
        type: 'boolean',
        description: 'Include active issues in snapshot (default: true)',
      },
      include_connections: {
        type: 'boolean',
        description: 'Include connection state (DHCP leases, etc.) in snapshot (default: true)',
      },
      include_firewall: {
        type: 'boolean',
        description: 'Include firewall state in snapshot (default: false)',
      },
      baseline_id: {
        type: 'string',
        description: 'Snapshot ID to use as baseline for comparison (for compare)',
      },
      current_id: {
        type: 'string',
        description: 'Snapshot ID to compare against baseline (for compare). If not provided, captures new snapshot.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of snapshots to return (for list, default: 10)',
      },
    },
    required: ['action'],
  };

  private snapshots: Map<string, SystemSnapshot> = new Map();
  private snapshotsByConversation: Map<string, string[]> = new Map();

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    const action = params.action as string;

    try {
      switch (action) {
        case 'capture':
          return await this.captureSnapshot(params, startTime);
        case 'compare':
          return await this.compareSnapshots(params, startTime);
        case 'list':
          return await this.listSnapshots(params, startTime);
        default:
          return this.error(`Unknown action: ${action}`, startTime);
      }
    } catch (error: any) {
      console.error('[SystemStateTool] Error:', error);
      return this.error(error.message || 'Unknown error occurred', Date.now() - startTime);
    }
  }

  private async captureSnapshot(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const conversation_id = params.conversation_id as string | undefined;
    const include_metrics = params.include_metrics !== false; // default true
    const include_issues = params.include_issues !== false; // default true
    const include_connections = params.include_connections !== false; // default true
    const include_firewall = params.include_firewall === true; // default false

    const snapshot: SystemSnapshot = {
      timestamp: Date.now(),
      snapshot_id: this.generateSnapshotId(),
      conversation_id,
    };

    // Capture system metrics
    if (include_metrics) {
      try {
        const data = await mikrotikService.getSystemResources();
        if (data) {
          snapshot.cpu_usage = parseFloat(data['cpu-load']) || 0;
          snapshot.memory_usage = data['free-memory'] && data['total-memory']
            ? ((data['total-memory'] - data['free-memory']) / data['total-memory']) * 100
            : undefined;
          snapshot.uptime = data['uptime'] || undefined;
        }
      } catch (error) {
        console.warn('[SystemStateTool] Failed to capture metrics:', error);
      }
    }

    // Capture active issues
    if (include_issues) {
      try {
        const agentDb = getAgentDatabase();
        const activeIssues = agentDb.getIssues({ status: 'detected' });
        snapshot.active_issues = activeIssues.map(issue => ({
          id: issue.id,
          severity: issue.severity,
          title: issue.title,
        }));
        snapshot.issue_count = activeIssues.length;
      } catch (error) {
        console.warn('[SystemStateTool] Failed to capture issues:', error);
      }
    }

    // Capture connection state
    if (include_connections) {
      try {
        const dhcpLeases = await mikrotikService.getDhcpLeases();
        if (Array.isArray(dhcpLeases)) {
          snapshot.dhcp_leases_count = dhcpLeases.length;
        }
      } catch (error) {
        console.warn('[SystemStateTool] Failed to capture DHCP leases:', error);
      }
    }

    // Capture firewall state
    if (include_firewall) {
      try {
        const firewallRules = await mikrotikService.getFirewallFilterRules();
        if (Array.isArray(firewallRules)) {
          snapshot.firewall_rules_count = firewallRules.length;
        }
      } catch (error) {
        console.warn('[SystemStateTool] Failed to capture firewall rules:', error);
      }
    }

    // Store snapshot
    this.snapshots.set(snapshot.snapshot_id, snapshot);

    // Track by conversation
    if (conversation_id) {
      const conversationSnapshots = this.snapshotsByConversation.get(conversation_id) || [];
      conversationSnapshots.push(snapshot.snapshot_id);
      this.snapshotsByConversation.set(conversation_id, conversationSnapshots);
    }

    return this.success({
      snapshot,
      snapshot_id: snapshot.snapshot_id,
      message: `Captured system state snapshot: ${snapshot.snapshot_id}`,
      usage_hint: `Use compare action with baseline_id="${snapshot.snapshot_id}" to see changes later`,
    }, startTime);
  }

  private async compareSnapshots(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const baseline_id = params.baseline_id as string;
    let current_id = params.current_id as string | undefined;

    if (!baseline_id) {
      return this.error('Missing required parameter: baseline_id', startTime);
    }

    const baseline = this.snapshots.get(baseline_id);
    if (!baseline) {
      return this.error(`Baseline snapshot not found: ${baseline_id}`, startTime);
    }

    let current: SystemSnapshot;

    // If no current_id provided, capture new snapshot
    if (!current_id) {
      const captureResult = await this.captureSnapshot({
        action: 'capture',
        conversation_id: baseline.conversation_id,
        include_metrics: true,
        include_issues: true,
        include_connections: true,
        include_firewall: params.include_firewall,
      }, startTime);

      if (!captureResult.success) {
        return captureResult;
      }

      current = (captureResult.data as any).snapshot;
      current_id = current.snapshot_id;
    } else {
      const currentSnapshot = this.snapshots.get(current_id);
      if (!currentSnapshot) {
        return this.error(`Current snapshot not found: ${current_id}`, startTime);
      }
      current = currentSnapshot;
    }

    // Calculate differences
    const changes: any = {
      time_elapsed_ms: current.timestamp - baseline.timestamp,
      time_elapsed_human: this.formatDuration(current.timestamp - baseline.timestamp),
    };

    // Metric changes
    if (baseline.cpu_usage !== undefined && current.cpu_usage !== undefined) {
      const cpuChange = current.cpu_usage - baseline.cpu_usage;
      changes.cpu_change = {
        baseline: baseline.cpu_usage,
        current: current.cpu_usage,
        delta: cpuChange,
        direction: cpuChange > 0 ? 'increased' : cpuChange < 0 ? 'decreased' : 'unchanged',
      };
    }

    if (baseline.memory_usage !== undefined && current.memory_usage !== undefined) {
      const memoryChange = current.memory_usage - baseline.memory_usage;
      changes.memory_change = {
        baseline: baseline.memory_usage,
        current: current.memory_usage,
        delta: memoryChange,
        direction: memoryChange > 0 ? 'increased' : memoryChange < 0 ? 'decreased' : 'unchanged',
      };
    }

    // Issue changes
    if (baseline.issue_count !== undefined && current.issue_count !== undefined) {
      const issueChange = current.issue_count - baseline.issue_count;
      changes.issue_count_change = {
        baseline: baseline.issue_count,
        current: current.issue_count,
        delta: issueChange,
        direction: issueChange > 0 ? 'increased' : issueChange < 0 ? 'decreased' : 'unchanged',
      };

      // Identify new and resolved issues
      const baselineIssueIds = new Set(baseline.active_issues?.map(i => i.id) || []);
      const currentIssueIds = new Set(current.active_issues?.map(i => i.id) || []);

      const newIssues = current.active_issues?.filter(i => !baselineIssueIds.has(i.id)) || [];
      const resolvedIssues = baseline.active_issues?.filter(i => !currentIssueIds.has(i.id)) || [];

      if (newIssues.length > 0) {
        changes.new_issues = newIssues;
      }
      if (resolvedIssues.length > 0) {
        changes.resolved_issues = resolvedIssues;
      }
    }

    // Connection changes
    if (baseline.dhcp_leases_count !== undefined && current.dhcp_leases_count !== undefined) {
      const dhcpChange = current.dhcp_leases_count - baseline.dhcp_leases_count;
      changes.dhcp_leases_change = {
        baseline: baseline.dhcp_leases_count,
        current: current.dhcp_leases_count,
        delta: dhcpChange,
        direction: dhcpChange > 0 ? 'increased' : dhcpChange < 0 ? 'decreased' : 'unchanged',
      };
    }

    // Generate insights
    const insights = this.generateComparisonInsights(changes);

    return this.success({
      baseline_snapshot: baseline,
      current_snapshot: current,
      changes,
      insights,
      summary: this.generateChangeSummary(changes),
    }, startTime);
  }

  private async listSnapshots(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const conversation_id = params.conversation_id as string | undefined;
    const limit = (params.limit as number) || 10;

    let snapshotIds: string[];

    if (conversation_id) {
      snapshotIds = this.snapshotsByConversation.get(conversation_id) || [];
    } else {
      snapshotIds = Array.from(this.snapshots.keys());
    }

    // Get most recent snapshots
    const snapshots = snapshotIds
      .map(id => this.snapshots.get(id)!)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return this.success({
      snapshots,
      count: snapshots.length,
      total: snapshotIds.length,
    }, startTime);
  }

  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private generateComparisonInsights(changes: any): string[] {
    const insights: string[] = [];

    // CPU insights
    if (changes.cpu_change) {
      const { delta, direction } = changes.cpu_change;
      if (Math.abs(delta) > 10) {
        insights.push(`CPU usage ${direction} significantly by ${Math.abs(delta).toFixed(1)}%`);
      }
    }

    // Memory insights
    if (changes.memory_change) {
      const { delta, direction } = changes.memory_change;
      if (Math.abs(delta) > 5) {
        insights.push(`Memory usage ${direction} by ${Math.abs(delta).toFixed(1)}%`);
      }
    }

    // Issue insights
    if (changes.resolved_issues && changes.resolved_issues.length > 0) {
      insights.push(`✓ ${changes.resolved_issues.length} issue(s) resolved`);
    }
    if (changes.new_issues && changes.new_issues.length > 0) {
      insights.push(`⚠ ${changes.new_issues.length} new issue(s) detected`);
    }

    // Connection insights
    if (changes.dhcp_leases_change) {
      const { delta, direction } = changes.dhcp_leases_change;
      if (delta !== 0) {
        insights.push(`DHCP leases ${direction} by ${Math.abs(delta)}`);
      }
    }

    if (insights.length === 0) {
      insights.push('No significant changes detected between snapshots');
    }

    return insights;
  }

  private generateChangeSummary(changes: any): string {
    const parts: string[] = [];

    if (changes.resolved_issues && changes.resolved_issues.length > 0) {
      parts.push(`${changes.resolved_issues.length} issue(s) resolved`);
    }
    if (changes.new_issues && changes.new_issues.length > 0) {
      parts.push(`${changes.new_issues.length} new issue(s)`);
    }
    if (changes.cpu_change && Math.abs(changes.cpu_change.delta) > 5) {
      parts.push(`CPU ${changes.cpu_change.direction} ${Math.abs(changes.cpu_change.delta).toFixed(1)}%`);
    }

    return parts.length > 0
      ? parts.join(', ')
      : 'No significant changes detected';
  }
}
