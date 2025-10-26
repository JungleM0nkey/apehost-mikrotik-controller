/**
 * Health Monitor Background Service
 * Runs detection rules periodically and emits WebSocket events for new issues
 */

import { getIssueDetector } from '../detector/issue-detector.js';
import { getAgentDatabase } from '../database/agent-db.js';
import type { Issue } from '../models/types.js';

export class HealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private detector = getIssueDetector();
  private db = getAgentDatabase();
  private wsEmit: ((event: string, data: any) => void) | null = null;

  /**
   * Set WebSocket emit function for real-time notifications
   */
  setWebSocketEmitter(emitFn: (event: string, data: any) => void): void {
    this.wsEmit = emitFn;
  }

  /**
   * Start the health monitor
   */
  start(): void {
    if (this.isRunning) {
      console.log('[HealthMonitor] Already running');
      return;
    }

    console.log('[HealthMonitor] Starting background health checks (every 5 minutes)');
    this.isRunning = true;

    // Run initial check immediately
    this.runHealthCheck().catch(err => {
      console.error('[HealthMonitor] Initial check failed:', err);
    });

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runHealthCheck().catch(err => {
        console.error('[HealthMonitor] Periodic check failed:', err);
      });
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the health monitor
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[HealthMonitor] Not running');
      return;
    }

    console.log('[HealthMonitor] Stopping background health checks');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): { running: boolean; lastCheck?: number; nextCheck?: number } {
    return {
      running: this.isRunning,
      lastCheck: this.lastCheckTime,
      nextCheck: this.isRunning && this.lastCheckTime
        ? this.lastCheckTime + this.CHECK_INTERVAL_MS
        : undefined,
    };
  }

  private lastCheckTime?: number;

  /**
   * Run a complete health check
   */
  private async runHealthCheck(): Promise<void> {
    const startTime = Date.now();
    console.log('[HealthMonitor] Running health check...');

    try {
      // Perform deep scan - detects issues and stores new ones
      const { newIssues, allActiveIssues } = await this.detector.performDeepScan();

      this.lastCheckTime = Date.now();
      const duration = this.lastCheckTime - startTime;

      console.log(`[HealthMonitor] Check complete in ${duration}ms - Found ${newIssues.length} new issues, ${allActiveIssues.length} total active`);

      // Emit WebSocket events for new issues
      if (this.wsEmit && newIssues.length > 0) {
        for (const issue of newIssues) {
          this.wsEmit('agent:newIssue', issue);
          console.log(`[HealthMonitor] Emitted new issue: ${issue.title} (${issue.severity})`);
        }

        // Also emit a scan complete event
        this.wsEmit('agent:scanComplete', {
          timestamp: this.lastCheckTime,
          newIssuesCount: newIssues.length,
          totalActiveIssues: allActiveIssues.length,
          duration,
        });
      }

      // Store metrics snapshot
      this.storeMetricsSnapshot();

      // Check for auto-resolved issues
      this.checkAutoResolved(allActiveIssues);
    } catch (error) {
      console.error('[HealthMonitor] Health check failed:', error);
    }
  }

  /**
   * Store current metrics snapshot for trending
   */
  private async storeMetricsSnapshot(): Promise<void> {
    try {
      // Note: This will be enhanced when we have proper metrics collection
      // For now, just store timestamp to track monitoring activity
      this.db.createMetricsSnapshot({
        collected_at: Date.now(),
        cpu_usage: undefined,
        memory_usage: undefined,
        disk_usage: undefined,
        uptime: undefined,
        connection_count: undefined,
        interface_stats: undefined,
      });
    } catch (error) {
      console.error('[HealthMonitor] Failed to store metrics:', error);
    }
  }

  /**
   * Check if any previously detected issues have been auto-resolved
   */
  private async checkAutoResolved(currentActiveIssues: Issue[]): Promise<void> {
    const allDetectedIssues = this.db.getIssues({ status: 'detected' });

    // For each detected issue, if it's not in currentActiveIssues, it may be resolved
    for (const dbIssue of allDetectedIssues) {
      const stillActive = currentActiveIssues.some(
        active => active.title === dbIssue.title && active.category === dbIssue.category
      );

      if (!stillActive) {
        // Issue appears to be resolved
        this.db.updateIssueStatus(dbIssue.id, 'resolved', Date.now());
        console.log(`[HealthMonitor] Auto-resolved issue: ${dbIssue.title}`);

        // Emit WebSocket event
        if (this.wsEmit) {
          this.wsEmit('agent:issueResolved', {
            id: dbIssue.id,
            title: dbIssue.title,
            resolvedAt: Date.now(),
          });
        }
      }
    }
  }

  /**
   * Trigger an immediate health check (on-demand)
   */
  async runImmediateCheck(): Promise<{ newIssues: Issue[]; allActiveIssues: Issue[] }> {
    console.log('[HealthMonitor] Running immediate check...');
    const result = await this.detector.performDeepScan();

    this.lastCheckTime = Date.now();

    // Emit WebSocket events
    if (this.wsEmit && result.newIssues.length > 0) {
      for (const issue of result.newIssues) {
        this.wsEmit('agent:newIssue', issue);
      }
    }

    return result;
  }
}

// Singleton instance
let instance: HealthMonitor | null = null;

export function getHealthMonitor(): HealthMonitor {
  if (!instance) {
    instance = new HealthMonitor();
  }
  return instance;
}
