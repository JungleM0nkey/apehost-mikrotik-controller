import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

/**
 * Detects if firewall has no DROP rules
 * This is a CRITICAL security vulnerability
 */
export class NoDropRulesRule extends BaseDetectionRule {
  readonly name = 'no-drop-rules';
  readonly category = 'security' as const;
  readonly severity = 'critical' as const;
  readonly description = 'Firewall has no DROP rules, allowing all traffic';

  async detect(state: RouterState): Promise<Issue | null> {
    const firewallRules = state.firewall_rules;

    if (!firewallRules || !Array.isArray(firewallRules)) {
      // No firewall data available
      return null;
    }

    if (firewallRules.length === 0) {
      return this.createIssue(
        'No Firewall Rules Configured',
        'Your MikroTik router has no firewall rules at all. This leaves your network completely unprotected.',
        'Add firewall rules to protect your network. Start with basic input chain rules to drop invalid traffic and allow established connections.',
        0.95
      );
    }

    // Check if any rules have action=drop
    const hasDropRules = firewallRules.some((rule: any) =>
      rule.action === 'drop' || rule.action === 'reject'
    );

    if (!hasDropRules) {
      const enabledRules = firewallRules.filter((rule: any) => !rule.disabled);

      return this.createIssue(
        'Firewall Has No DROP Rules',
        `Your firewall has ${enabledRules.length} rules but none of them block traffic. All rules are ACCEPT or other non-blocking actions.`,
        'Add DROP rules to block unwanted traffic. Common practices: Drop invalid connections, drop new connections not from LAN, drop from WAN to router itself.',
        0.92
      );
    }

    return null; // Has drop rules, this is good
  }
}
