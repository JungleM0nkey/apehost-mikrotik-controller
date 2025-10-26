/**
 * Detects if NTP (Network Time Protocol) is not configured
 * Causes time drift which affects logging, certificates, and scheduled tasks
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class NoNTPConfiguredRule extends BaseDetectionRule {
  readonly name = 'no-ntp-configured';
  readonly category = 'configuration' as const;
  readonly severity = 'medium' as const;
  readonly description = 'NTP time synchronization not configured';

  async detect(state: RouterState): Promise<Issue | null> {
    // Note: This requires NTP client configuration data
    // For now, placeholder that will be enhanced when we add SystemConfigTool

    // TODO: Implement when SystemConfigTool is available
    // Expected data: state.system_settings?.ntp_client = { enabled: false, servers: [] }

    return null; // Placeholder - requires system config MCP tool
  }
}
