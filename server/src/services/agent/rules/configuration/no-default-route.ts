/**
 * Detects if no default route is configured
 * Prevents internet access and external network connectivity
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class NoDefaultRouteRule extends BaseDetectionRule {
  readonly name = 'no-default-route';
  readonly category = 'configuration' as const;
  readonly severity = 'medium' as const;
  readonly description = 'No default gateway/route configured';

  async detect(state: RouterState): Promise<Issue | null> {
    // Note: This requires routing table data from MCP tool
    // For now, placeholder that will be enhanced when we add RoutingTool

    // TODO: Implement when RoutingTool is available
    // Expected data: state.routes = [{ dst_address: '0.0.0.0/0', gateway: '192.168.1.1' }]

    return null; // Placeholder - requires routing MCP tool
  }
}
