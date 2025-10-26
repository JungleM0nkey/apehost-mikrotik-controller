/**
 * Detects disk space exhaustion (>90% usage)
 * Can prevent logging, package updates, and system stability
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class DiskFullRule extends BaseDetectionRule {
  readonly name = 'disk-full';
  readonly category = 'stability' as const;
  readonly severity = 'high' as const;
  readonly description = 'Disk space is critically low';

  private readonly WARNING_THRESHOLD = 85; // 85%
  private readonly CRITICAL_THRESHOLD = 95; // 95%

  async detect(state: RouterState): Promise<Issue | null> {
    const systemResources = state.system_resources;

    if (!systemResources || !systemResources.free_hdd_space || !systemResources.total_hdd_space) {
      return null; // No disk data available
    }

    const totalDisk = parseInt(systemResources.total_hdd_space);
    const freeDisk = parseInt(systemResources.free_hdd_space);

    if (isNaN(totalDisk) || isNaN(freeDisk) || totalDisk === 0) {
      return null;
    }

    const usedDisk = totalDisk - freeDisk;
    const diskUsagePercent = (usedDisk / totalDisk) * 100;

    if (diskUsagePercent >= this.CRITICAL_THRESHOLD) {
      const freeMB = (freeDisk / (1024 * 1024)).toFixed(1);
      return this.createIssue(
        'Critical Disk Space',
        `Disk usage is at ${diskUsagePercent.toFixed(1)}% with only ${freeMB}MB free. System may fail to log events or update packages.`,
        'Clear old log files (/log print file=oldlogs; /file remove oldlogs.txt). Remove unnecessary backup files. Remove unused packages (/system package print). Consider upgrading router with more storage.',
        0.95
      );
    } else if (diskUsagePercent >= this.WARNING_THRESHOLD) {
      const freeMB = (freeDisk / (1024 * 1024)).toFixed(1);
      return this.createIssue(
        'Low Disk Space',
        `Disk usage is at ${diskUsagePercent.toFixed(1)}% with ${freeMB}MB free. Monitor to prevent space exhaustion.`,
        'Review and clean up old log files, backups, and unnecessary files. Monitor disk usage trends.',
        0.85
      );
    }

    return null;
  }
}
