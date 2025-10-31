/**
 * Background Metrics Collector
 * Phase 3: Advanced Intelligence - Trend Analysis
 *
 * Periodically collects system metrics and stores them for trend analysis
 */

import { getAgentDatabase } from './database/agent-db.js';
import mikrotikService from '../mikrotik.js';

export class MetricsCollector {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private collectInterval = 5 * 60 * 1000; // 5 minutes

  constructor(intervalMinutes: number = 5) {
    this.collectInterval = intervalMinutes * 60 * 1000;
  }

  start(): void {
    if (this.isRunning) {
      console.warn('[MetricsCollector] Already running');
      return;
    }

    console.log(`[MetricsCollector] Starting metrics collection (every ${this.collectInterval / 60000} minutes)`);
    this.isRunning = true;

    // Collect immediately on start
    this.collectMetrics();

    // Then collect periodically
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.collectInterval);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[MetricsCollector] Stopping metrics collection');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isCollecting(): boolean {
    return this.isRunning;
  }

  private async collectMetrics(): Promise<void> {
    try {
      const agentDb = getAgentDatabase();

      // Collect system resources
      const data = await mikrotikService.getSystemResources();
      if (data) {
        // CPU usage
        if (data['cpu-load'] !== undefined) {
          const cpuUsage = parseFloat(data['cpu-load']);
          agentDb.recordMetric('cpu_usage', cpuUsage);
        }

        // Memory usage
        if (data['free-memory'] && data['total-memory']) {
          const memoryUsage = ((data['total-memory'] - data['free-memory']) / data['total-memory']) * 100;
          agentDb.recordMetric('memory_usage', memoryUsage);
        }

        // Uptime
        if (data['uptime']) {
          agentDb.recordMetric('uptime', data['uptime']);
        }
      }

      // Collect DHCP lease count
      const dhcpLeases = await mikrotikService.getDhcpLeases();
      if (Array.isArray(dhcpLeases)) {
        agentDb.recordMetric('dhcp_leases_count', dhcpLeases.length);
      }

      // Collect interface statistics
      const interfaces = await mikrotikService.getInterfaces();
      if (Array.isArray(interfaces)) {
        for (const iface of interfaces) {
          const name = iface.name || iface.id;
          if (!name) continue;

          // RX bytes
          if (iface.rxBytes !== undefined) {
            agentDb.recordMetric('interface_rx_bytes', iface.rxBytes, { interface: name });
          }

          // TX bytes
          if (iface.txBytes !== undefined) {
            agentDb.recordMetric('interface_tx_bytes', iface.txBytes, { interface: name });
          }
        }
      }

      // Collect active issue count
      const activeIssues = agentDb.getIssues({ status: 'detected' });
      agentDb.recordMetric('active_issues_count', activeIssues.length);

      console.log(`[MetricsCollector] Collected metrics at ${new Date().toISOString()}`);

    } catch (error) {
      console.error('[MetricsCollector] Error collecting metrics:', error);
    }
  }

  // Manual collection trigger (useful for testing)
  async collectNow(): Promise<void> {
    await this.collectMetrics();
  }

  // Cleanup old metrics (keep last 30 days by default)
  async cleanup(daysToKeep: number = 30): Promise<number> {
    const agentDb = getAgentDatabase();
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const deleted = agentDb.cleanOldMetrics(cutoffTime);
    console.log(`[MetricsCollector] Cleaned up ${deleted} old metrics (older than ${daysToKeep} days)`);
    return deleted;
  }
}

// Singleton instance
let instance: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!instance) {
    instance = new MetricsCollector();
  }
  return instance;
}

export function startMetricsCollection(intervalMinutes: number = 5): void {
  const collector = getMetricsCollector();
  if (collector.isCollecting()) {
    console.log('[MetricsCollector] Already collecting metrics');
    return;
  }
  collector.start();
}

export function stopMetricsCollection(): void {
  const collector = getMetricsCollector();
  collector.stop();
}
