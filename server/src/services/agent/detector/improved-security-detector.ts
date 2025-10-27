/**
 * Improved Security Detector with Multi-Layer Analysis
 * Evidence-based detection with confidence calibration
 */

import type { RouterState, Issue } from '../models/types.js';
import type {
  SecurityAnalysis,
  ServiceCheckEvidence,
  FirewallCheckEvidence,
  AccessibilityTestEvidence,
  DetectionEvidence,
} from '../models/feedback-types.js';
import mikrotikService from '../../mikrotik.js';

export class ImprovedSecurityDetector {
  /**
   * Perform multi-layer security analysis on WAN interface
   */
  async analyzeWANSecurity(
    state: RouterState,
    wanInterfaceName: string
  ): Promise<SecurityAnalysis> {
    const timestamp = Date.now();

    // Layer 1: Check service status
    const services = await this.checkServiceStatus();
    const services_verified = services.length > 0;

    // Layer 2: Analyze firewall rules comprehensively
    const firewall = await this.analyzeFirewallRules(state, wanInterfaceName);
    const firewall_verified = firewall.rules_analyzed > 0;

    // Layer 3: Test actual accessibility (if possible)
    const accessibility_tests = await this.testAccessibility(services);
    const accessibility_tested = accessibility_tests.length > 0;

    // Layer 4: Configuration verification
    const has_full_config_access = services_verified && firewall_verified;
    const config_verification_method = services_verified ? 'api' : 'limited';

    // Determine if there's an actual vulnerability
    const has_vulnerability = this.assessVulnerability({
      services,
      firewall,
      accessibility_tests,
    });

    // Calculate evidence-based confidence
    const confidence = this.calculateConfidence({
      services_verified,
      firewall_verified,
      accessibility_tested,
      has_full_config_access,
    });

    // Collect all evidence
    const all_evidence = this.collectEvidence({
      services,
      firewall,
      accessibility_tests,
      timestamp,
    });

    return {
      rule_name: 'wan-management-exposed',
      interface_name: wanInterfaceName,
      timestamp,
      services,
      services_verified,
      firewall,
      firewall_verified,
      accessibility_tests,
      accessibility_tested,
      has_full_config_access,
      config_verification_method,
      has_vulnerability,
      confidence,
      all_evidence,
    };
  }

  /**
   * Layer 1: Check management service status via MikroTik API
   */
  private async checkServiceStatus(): Promise<ServiceCheckEvidence[]> {
    const MANAGEMENT_SERVICES = ['winbox', 'ssh', 'telnet', 'www', 'www-ssl'];

    try {
      // Try to get service configuration from MikroTik API
      // This would require adding a new MCP tool or API endpoint
      // For now, we return empty array indicating we couldn't verify
      // In production, implement: const services = await mikrotikService.getServices();

      return [];
    } catch (error) {
      console.warn('[ImprovedDetector] Could not verify service status:', error);
      return [];
    }
  }

  /**
   * Layer 2: Comprehensive firewall analysis
   * Checks explicit rules, interface lists, and global rules
   */
  private async analyzeFirewallRules(
    state: RouterState,
    wanInterfaceName: string
  ): Promise<FirewallCheckEvidence> {
    const firewallRules = state.firewall_rules || [];

    // Check explicit interface rules
    const explicitRules = firewallRules.filter(
      (rule: any) =>
        !rule.disabled &&
        rule.chain === 'input' &&
        rule.in_interface === wanInterfaceName
    );

    // Check interface list rules (common in modern configs)
    const interfaceListRules = firewallRules.filter(
      (rule: any) =>
        !rule.disabled &&
        rule.chain === 'input' &&
        rule.in_interface_list && // Uses interface lists
        (rule.action === 'drop' || rule.action === 'reject')
    );

    // Check global input chain protection
    const globalInputRules = firewallRules.filter(
      (rule: any) =>
        !rule.disabled &&
        rule.chain === 'input' &&
        !rule.in_interface &&
        !rule.in_interface_list &&
        (rule.action === 'drop' || rule.action === 'reject')
    );

    // Check for drop rules specifically on this interface or its list
    const hasExplicitProtection = explicitRules.some(
      (rule: any) => rule.action === 'drop' || rule.action === 'reject'
    );

    const hasListProtection = interfaceListRules.length > 0;
    const hasGlobalProtection = globalInputRules.length > 0;

    return {
      source: 'firewall_analysis',
      verified: true,
      details: {
        explicit_rules: explicitRules,
        interface_list_rules: interfaceListRules,
        global_rules: globalInputRules,
      },
      rules_analyzed: firewallRules.length,
      explicit_interface_rules: explicitRules.length,
      interface_list_rules: interfaceListRules.length,
      global_input_rules: globalInputRules.length,
      has_effective_protection:
        hasExplicitProtection || hasListProtection || hasGlobalProtection,
      interface_list_membership: this.extractInterfaceLists(firewallRules),
    };
  }

  /**
   * Layer 3: Test actual service accessibility
   * In production, this would perform real connectivity tests
   */
  private async testAccessibility(
    services: ServiceCheckEvidence[]
  ): Promise<AccessibilityTestEvidence[]> {
    // In production, implement actual connectivity tests
    // For now, return empty array indicating tests not performed
    // Real implementation would use network scanning from external perspective

    return [];
  }

  /**
   * Extract interface list names from firewall rules
   */
  private extractInterfaceLists(rules: any[]): string[] {
    const lists = new Set<string>();
    rules.forEach((rule: any) => {
      if (rule.in_interface_list) {
        lists.add(rule.in_interface_list);
      }
    });
    return Array.from(lists);
  }

  /**
   * Assess if there's an actual vulnerability based on evidence
   */
  private assessVulnerability(evidence: {
    services: ServiceCheckEvidence[];
    firewall: FirewallCheckEvidence;
    accessibility_tests: AccessibilityTestEvidence[];
  }): boolean {
    // If we verified services are disabled, no vulnerability
    if (evidence.services.length > 0) {
      const allDisabled = evidence.services.every((s) => !s.enabled);
      if (allDisabled) {
        return false;
      }

      // If services are restricted to LAN only, no vulnerability
      const allRestricted = evidence.services.every(
        (s) => s.address_restriction && !s.address_restriction.includes('0.0.0.0')
      );
      if (allRestricted) {
        return false;
      }
    }

    // If firewall has effective protection, no vulnerability
    if (evidence.firewall.has_effective_protection) {
      return false;
    }

    // If we tested accessibility and nothing is accessible, no vulnerability
    if (evidence.accessibility_tests.length > 0) {
      const anyAccessible = evidence.accessibility_tests.some((t) => t.accessible);
      if (!anyAccessible) {
        return false;
      }
    }

    // If we have no service info and no firewall protection, potential vulnerability
    if (evidence.services.length === 0 && !evidence.firewall.has_effective_protection) {
      return true; // Potential, but not confirmed
    }

    // Default: assume vulnerability if we can't rule it out
    return true;
  }

  /**
   * Calculate evidence-based confidence score
   * Confidence reflects how certain we are about our conclusion
   */
  private calculateConfidence(verification: {
    services_verified: boolean;
    firewall_verified: boolean;
    accessibility_tested: boolean;
    has_full_config_access: boolean;
  }): number {
    const scores = [
      {
        category: 'Service Status',
        weight: 0.35,
        confidence: verification.services_verified ? 1.0 : 0.3,
      },
      {
        category: 'Firewall Rules',
        weight: 0.25,
        confidence: verification.firewall_verified ? 1.0 : 0.5,
      },
      {
        category: 'Accessibility Test',
        weight: 0.30,
        confidence: verification.accessibility_tested ? 0.95 : 0.2,
      },
      {
        category: 'Config Access',
        weight: 0.10,
        confidence: verification.has_full_config_access ? 1.0 : 0.4,
      },
    ];

    const weightedConfidence = scores.reduce(
      (sum, s) => sum + s.weight * s.confidence,
      0
    );

    return Math.round(weightedConfidence * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Collect all evidence into structured format
   */
  private collectEvidence(data: {
    services: ServiceCheckEvidence[];
    firewall: FirewallCheckEvidence;
    accessibility_tests: AccessibilityTestEvidence[];
    timestamp: number;
  }): DetectionEvidence[] {
    const evidence: DetectionEvidence[] = [];

    // Service evidence
    data.services.forEach((service) => {
      evidence.push({
        issue_id: '', // Will be filled when issue is created
        evidence_type: 'service_check',
        evidence_category: 'layer1',
        confidence_contribution: 0.35,
        evidence_data: service,
        collected_at: data.timestamp,
      });
    });

    // Firewall evidence
    evidence.push({
      issue_id: '',
      evidence_type: 'firewall_check',
      evidence_category: 'layer2',
      confidence_contribution: 0.25,
      evidence_data: data.firewall,
      collected_at: data.timestamp,
    });

    // Accessibility evidence
    data.accessibility_tests.forEach((test) => {
      evidence.push({
        issue_id: '',
        evidence_type: 'accessibility_test',
        evidence_category: 'layer3',
        confidence_contribution: 0.30,
        evidence_data: test,
        collected_at: data.timestamp,
      });
    });

    return evidence;
  }
}

// Singleton instance
let instance: ImprovedSecurityDetector | null = null;

export function getImprovedSecurityDetector(): ImprovedSecurityDetector {
  if (!instance) {
    instance = new ImprovedSecurityDetector();
  }
  return instance;
}
