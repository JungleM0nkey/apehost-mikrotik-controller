import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

/**
 * Detects high memory usage
 * Warns when memory usage exceeds 85%
 */
export class HighMemoryRule extends BaseDetectionRule {
  readonly name = 'high-memory-usage';
  readonly category = 'performance' as const;
  readonly severity = 'high' as const;
  readonly description = 'Memory usage is above 85%';

  private readonly MEMORY_WARNING_THRESHOLD = 85;
  private readonly MEMORY_CRITICAL_THRESHOLD = 95;

  async detect(state: RouterState): Promise<Issue | null> {
    const systemResources = state.system_resources;

    if (!systemResources || !systemResources.free_memory || !systemResources.total_memory) {
      // No memory data available
      return null;
    }

    const totalMemory = parseInt(systemResources.total_memory);
    const freeMemory = parseInt(systemResources.free_memory);

    if (isNaN(totalMemory) || isNaN(freeMemory) || totalMemory === 0) {
      return null;
    }

    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    if (memoryUsagePercent >= this.MEMORY_CRITICAL_THRESHOLD) {
      const freeMB = (freeMemory / (1024 * 1024)).toFixed(1);
      return this.createIssue(
        'Critical Memory Usage',
        `Memory usage is at ${memoryUsagePercent.toFixed(1)}% with only ${freeMB}MB free. System may become unstable.`,
        'Free up memory by clearing logs (/log print), removing unused connections, or increasing available RAM. Consider upgrading router hardware if this persists.',
        0.95
      );
    } else if (memoryUsagePercent >= this.MEMORY_WARNING_THRESHOLD) {
      const freeMB = (freeMemory / (1024 * 1024)).toFixed(1);
      return this.createIssue(
        'High Memory Usage',
        `Memory usage is at ${memoryUsagePercent.toFixed(1)}% with ${freeMB}MB free. Monitor for potential issues.`,
        'Check memory-consuming processes. Clear unnecessary logs and connections. Monitor trends to prevent exhaustion.',
        0.85
      );
    }

    return null; // Memory usage is normal
  }
}
