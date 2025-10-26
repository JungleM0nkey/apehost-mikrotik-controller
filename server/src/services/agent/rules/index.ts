/**
 * Detection Rules Index
 * Exports all available detection rules for the agent system
 */

import type { IDetectionRule } from '../models/types.js';

// Security Rules
import { NoDropRulesRule } from './security/no-drop-rules.js';
import { WANManagementExposedRule } from './security/wan-management-exposed.js';
import { DefaultAdminUserRule } from './security/default-admin-user.js';
import { WeakPasswordPolicyRule } from './security/weak-password-policy.js';

// Performance Rules
import { HighCPURule } from './performance/high-cpu.js';
import { HighMemoryRule } from './performance/high-memory.js';
import { InterfaceErrorsRule } from './performance/interface-errors.js';

// Stability Rules
import { DHCPPoolExhaustedRule } from './stability/dhcp-pool-exhausted.js';
import { DiskFullRule } from './stability/disk-full.js';

// Configuration Rules
import { NoDNSConfiguredRule } from './configuration/no-dns.js';
import { NoNTPConfiguredRule } from './configuration/no-ntp.js';
import { NoDefaultRouteRule } from './configuration/no-default-route.js';
import { DuplicateIPAddressesRule } from './configuration/duplicate-ips.js';

/**
 * All available detection rules
 * Rules are organized by category and sorted by priority
 */
export const ALL_RULES: IDetectionRule[] = [
  // Security Rules (CRITICAL and HIGH priority)
  new NoDropRulesRule(),
  new WANManagementExposedRule(),
  new DefaultAdminUserRule(),
  new WeakPasswordPolicyRule(),

  // Performance Rules (HIGH priority)
  new HighCPURule(),
  new HighMemoryRule(),
  new InterfaceErrorsRule(),

  // Stability Rules (HIGH priority)
  new DHCPPoolExhaustedRule(),
  new DiskFullRule(),

  // Configuration Rules (MEDIUM priority)
  new NoDNSConfiguredRule(),
  new NoNTPConfiguredRule(),
  new NoDefaultRouteRule(),
  new DuplicateIPAddressesRule(),
];

/**
 * Get rules filtered by category
 */
export function getRulesByCategory(category: 'security' | 'performance' | 'stability' | 'configuration'): IDetectionRule[] {
  return ALL_RULES.filter(rule => rule.category === category);
}

/**
 * Get rules filtered by severity
 */
export function getRulesBySeverity(severity: 'critical' | 'high' | 'medium' | 'low'): IDetectionRule[] {
  return ALL_RULES.filter(rule => rule.severity === severity);
}

/**
 * Get a specific rule by name
 */
export function getRuleByName(name: string): IDetectionRule | undefined {
  return ALL_RULES.find(rule => rule.name === name);
}

/**
 * Get rule counts by category
 */
export function getRuleCounts(): Record<string, number> {
  return {
    total: ALL_RULES.length,
    security: getRulesByCategory('security').length,
    performance: getRulesByCategory('performance').length,
    stability: getRulesByCategory('stability').length,
    configuration: getRulesByCategory('configuration').length,
  };
}
