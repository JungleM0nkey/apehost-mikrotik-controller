/**
 * Detects if management services (WinBox, SSH, HTTP) are exposed on WAN interface
 * CRITICAL security vulnerability - remote access from internet
 */

import { BaseDetectionRule } from '../base-rule.js';
import type { RouterState, Issue } from '../../models/types.js';

export class WANManagementExposedRule extends BaseDetectionRule {
  readonly name = 'wan-management-exposed';
  readonly category = 'security' as const;
  readonly severity = 'critical' as const;
  readonly description = 'Management services are accessible from WAN interface';

  private readonly MANAGEMENT_SERVICES = ['winbox', 'ssh', 'telnet', 'www', 'www-ssl', 'api', 'api-ssl'];

  async detect(state: RouterState): Promise<Issue | null> {
    const interfaces = state.interfaces;
    const firewallRules = state.firewall_rules;

    if (!interfaces || !Array.isArray(interfaces)) {
      return null; // No interface data available
    }

    // Identify WAN interface (typically ether1 or has 'wan' in name)
    const wanInterface = interfaces.find((iface: any) =>
      iface.name?.toLowerCase().includes('wan') ||
      iface.name?.toLowerCase().includes('ether1') ||
      iface.comment?.toLowerCase().includes('wan')
    );

    if (!wanInterface) {
      // Can't determine WAN interface, low confidence warning
      return null;
    }

    const wanInterfaceName = wanInterface.name;

    // Check if firewall blocks access to router on WAN interface
    if (firewallRules && Array.isArray(firewallRules)) {
      // Check for explicit interface rules
      const hasExplicitWANProtection = firewallRules.some((rule: any) =>
        !rule.disabled &&
        rule.chain === 'input' &&
        rule.in_interface === wanInterfaceName &&
        (rule.action === 'drop' || rule.action === 'reject')
      );

      // Check for interface list rules (modern MikroTik configurations)
      // Common list names: WAN, External, Internet, Public
      const hasInterfaceListProtection = firewallRules.some((rule: any) =>
        !rule.disabled &&
        rule.chain === 'input' &&
        rule.in_interface_list &&
        (rule.action === 'drop' || rule.action === 'reject')
      );

      const hasWANInputProtection = hasExplicitWANProtection || hasInterfaceListProtection;

      if (!hasWANInputProtection) {
        const exposedServices = this.MANAGEMENT_SERVICES.join(', ');
        return this.createIssue(
          'WAN Interface Management Access Exposed',
          `Your WAN interface (${wanInterfaceName}) has no firewall rules blocking incoming connections to the router. Management services like WinBox, SSH, and HTTP are likely accessible from the internet.`,
          `Add firewall input chain rules to block all incoming connections on ${wanInterfaceName} except established/related. Example:\n/ip firewall filter add chain=input in-interface=${wanInterfaceName} connection-state=established,related action=accept\n/ip firewall filter add chain=input in-interface=${wanInterfaceName} action=drop`,
          0.85
        );
      }
    }

    return null; // WAN interface is protected
  }
}
