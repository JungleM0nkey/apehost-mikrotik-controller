/**
 * Detects high error rates on network interfaces
 * Indicates hardware issues, cable problems, or configuration errors
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class InterfaceErrorsRule extends BaseDetectionRule {
  readonly name = 'interface-errors';
  readonly category = 'performance' as const;
  readonly severity = 'high' as const;
  readonly description = 'Network interface has high error rate';

  private readonly ERROR_RATE_THRESHOLD = 0.01; // 1% error rate
  private readonly MIN_PACKETS_FOR_ANALYSIS = 1000; // Minimum packets to calculate meaningful rate

  async detect(state: RouterState): Promise<Issue | null> {
    const interfaces = state.interfaces;

    if (!interfaces || !Array.isArray(interfaces)) {
      return null; // No interface data available
    }

    const problematicInterfaces: Array<{ name: string; errorRate: number; rxErrors: number; txErrors: number }> = [];

    for (const iface of interfaces) {
      // Skip disabled interfaces
      if (iface.disabled) continue;

      const rxPackets = parseInt(iface.rx_packet) || 0;
      const txPackets = parseInt(iface.tx_packet) || 0;
      const rxErrors = parseInt(iface.rx_error) || 0;
      const txErrors = parseInt(iface.tx_error) || 0;

      const totalPackets = rxPackets + txPackets;
      const totalErrors = rxErrors + txErrors;

      // Skip interfaces with too little traffic
      if (totalPackets < this.MIN_PACKETS_FOR_ANALYSIS) continue;

      const errorRate = totalErrors / totalPackets;

      if (errorRate >= this.ERROR_RATE_THRESHOLD) {
        problematicInterfaces.push({
          name: iface.name,
          errorRate,
          rxErrors,
          txErrors,
        });
      }
    }

    if (problematicInterfaces.length === 0) {
      return null; // No problematic interfaces
    }

    const interfaceList = problematicInterfaces
      .map(iface => `${iface.name} (${(iface.errorRate * 100).toFixed(2)}% errors, RX: ${iface.rxErrors}, TX: ${iface.txErrors})`)
      .join(', ');

    return this.createIssue(
      'High Interface Error Rate Detected',
      `The following interfaces have unusually high error rates: ${interfaceList}. This may indicate hardware issues, bad cables, duplex mismatch, or EMI interference.`,
      'Check physical connections and cables. Verify auto-negotiation settings (speed/duplex). Replace cables if necessary. Check for electromagnetic interference. Use /interface monitor <interface> to see real-time stats.',
      0.88
    );
  }
}
