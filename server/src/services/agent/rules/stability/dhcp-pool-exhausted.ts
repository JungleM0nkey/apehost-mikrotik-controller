/**
 * Detects DHCP pool exhaustion (>95% utilization)
 * Can prevent new devices from getting IP addresses
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class DHCPPoolExhaustedRule extends BaseDetectionRule {
  readonly name = 'dhcp-pool-exhausted';
  readonly category = 'stability' as const;
  readonly severity = 'high' as const;
  readonly description = 'DHCP pool is nearly exhausted';

  private readonly WARNING_THRESHOLD = 0.85; // 85%
  private readonly CRITICAL_THRESHOLD = 0.95; // 95%

  async detect(state: RouterState): Promise<Issue | null> {
    // Note: This requires DHCP server data from MCP tool
    // For now, placeholder that will be enhanced when we add DHCPTool

    // TODO: Implement when DHCPTool is available
    // Expected data: state.dhcp_servers = [{ pool: 'pool1', total: 100, leases: 95 }]

    return null; // Placeholder - requires DHCP MCP tool
  }
}
