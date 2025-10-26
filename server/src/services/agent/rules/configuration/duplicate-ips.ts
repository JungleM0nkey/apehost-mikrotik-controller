/**
 * Detects duplicate IP addresses assigned to multiple interfaces
 * Causes routing conflicts and network connectivity issues
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class DuplicateIPAddressesRule extends BaseDetectionRule {
  readonly name = 'duplicate-ip-addresses';
  readonly category = 'configuration' as const;
  readonly severity = 'high' as const;
  readonly description = 'Same IP address assigned to multiple interfaces';

  async detect(state: RouterState): Promise<Issue | null> {
    const interfaces = state.interfaces;

    if (!interfaces || !Array.isArray(interfaces)) {
      return null; // No interface data available
    }

    // Collect all IP addresses with their interfaces
    const ipMap = new Map<string, string[]>();

    for (const iface of interfaces) {
      if (iface.disabled) continue;

      // Handle both single address and address array formats
      const addresses = Array.isArray(iface.address) ? iface.address : [iface.address];

      for (const addr of addresses) {
        if (!addr) continue;

        // Extract IP without CIDR notation (e.g., "192.168.1.1/24" -> "192.168.1.1")
        const ip = addr.split('/')[0];

        if (!ipMap.has(ip)) {
          ipMap.set(ip, []);
        }
        ipMap.get(ip)!.push(iface.name);
      }
    }

    // Find duplicates
    const duplicates: Array<{ ip: string; interfaces: string[] }> = [];

    for (const [ip, ifaceList] of ipMap.entries()) {
      if (ifaceList.length > 1) {
        duplicates.push({ ip, interfaces: ifaceList });
      }
    }

    if (duplicates.length === 0) {
      return null; // No duplicates found
    }

    const duplicateList = duplicates
      .map(dup => `${dup.ip} on ${dup.interfaces.join(', ')}`)
      .join('; ');

    return this.createIssue(
      'Duplicate IP Addresses Detected',
      `The following IP addresses are assigned to multiple interfaces: ${duplicateList}. This creates routing conflicts and unpredictable network behavior.`,
      'Remove duplicate IP addresses. Each interface should have a unique IP address. Review your IP addressing scheme and fix conflicts using /ip address print and /ip address remove.',
      0.92
    );
  }
}
