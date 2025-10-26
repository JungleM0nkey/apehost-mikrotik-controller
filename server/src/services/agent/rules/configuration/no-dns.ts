/**
 * Detects if no DNS servers are configured
 * Causes name resolution failures and internet connectivity issues
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class NoDNSConfiguredRule extends BaseDetectionRule {
  readonly name = 'no-dns-configured';
  readonly category = 'configuration' as const;
  readonly severity = 'medium' as const;
  readonly description = 'No DNS servers configured';

  async detect(state: RouterState): Promise<Issue | null> {
    // Note: This requires DNS configuration data from system
    // For now, placeholder that will be enhanced when we add SystemConfigTool

    // TODO: Implement when SystemConfigTool is available
    // Expected data: state.system_settings?.dns_servers = ['8.8.8.8', '1.1.1.1']

    return null; // Placeholder - requires system config MCP tool
  }
}
