import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

/**
 * Detects high CPU usage
 * Warns when CPU usage exceeds 80%
 */
export class HighCPURule extends BaseDetectionRule {
  readonly name = 'high-cpu-usage';
  readonly category = 'performance' as const;
  readonly severity = 'high' as const;
  readonly description = 'CPU usage is above 80%';

  private readonly CPU_WARNING_THRESHOLD = 80;
  private readonly CPU_CRITICAL_THRESHOLD = 95;

  async detect(state: RouterState): Promise<Issue | null> {
    const systemResources = state.system_resources;

    if (!systemResources || !systemResources.cpu_load) {
      // No CPU data available
      return null;
    }

    const cpuUsage = parseFloat(systemResources.cpu_load);

    if (isNaN(cpuUsage)) {
      return null;
    }

    if (cpuUsage >= this.CPU_CRITICAL_THRESHOLD) {
      return this.createIssue(
        'Critical CPU Usage',
        `CPU usage is at ${cpuUsage.toFixed(1)}%, which is critically high. System may be unresponsive.`,
        'Identify the process consuming CPU using /system resource print. Consider restarting services or reducing load. Check for routing loops or firewall rule inefficiencies.',
        0.95
      );
    } else if (cpuUsage >= this.CPU_WARNING_THRESHOLD) {
      return this.createIssue(
        'High CPU Usage',
        `CPU usage is at ${cpuUsage.toFixed(1)}%, which is above normal operating levels.`,
        'Monitor CPU usage trends. If sustained, identify resource-hungry processes and optimize or restart them.',
        0.85
      );
    }

    return null; // CPU usage is normal
  }
}
