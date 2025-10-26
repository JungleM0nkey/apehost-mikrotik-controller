/**
 * Detects weak password policy configuration
 * HIGH security risk - brute force vulnerability
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class WeakPasswordPolicyRule extends BaseDetectionRule {
  readonly name = 'weak-password-policy';
  readonly category = 'security' as const;
  readonly severity = 'high' as const;
  readonly description = 'Weak password policy allows brute force attacks';

  async detect(state: RouterState): Promise<Issue | null> {
    // Note: This requires password policy settings from system
    // For now, placeholder that will be enhanced when we add system settings MCP tool

    // TODO: Implement when we can read /user settings
    // Expected data: state.system_settings?.password_policy = { min_length: 6, ... }

    return null; // Placeholder - requires system settings MCP tool
  }
}
