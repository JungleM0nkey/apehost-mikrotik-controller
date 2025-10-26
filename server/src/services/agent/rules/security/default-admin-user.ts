/**
 * Detects if default 'admin' user still exists with full privileges
 * CRITICAL security vulnerability - well-known username
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class DefaultAdminUserRule extends BaseDetectionRule {
  readonly name = 'default-admin-user';
  readonly category = 'security' as const;
  readonly severity = 'critical' as const;
  readonly description = 'Default admin user account still exists';

  async detect(state: RouterState): Promise<Issue | null> {
    // Note: This requires user list data from MCP tool
    // For now, we can't fully detect this without get_users tool
    // This is a placeholder that will be enhanced when we add UserManagementTool

    // TODO: Implement when UserManagementTool is available
    // Expected data: state.users = [{ name: 'admin', group: 'full', disabled: false }]

    return null; // Placeholder - requires user management MCP tool
  }
}
