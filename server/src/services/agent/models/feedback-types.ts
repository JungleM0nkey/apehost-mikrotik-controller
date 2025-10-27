/**
 * Feedback System Type Definitions
 * Types for false positive learning and improvement system
 */

export type FeedbackType = 'true_positive' | 'false_positive' | 'needs_investigation';

export type FalsePositiveReason =
  | 'services_disabled'
  | 'services_restricted'
  | 'interface_list_protection'
  | 'upstream_firewall'
  | 'other_protection_method'
  | 'incorrect_interface_type'
  | 'already_fixed';

/**
 * User feedback on an issue detection
 */
export interface IssueFeedback {
  id: string;
  issue_id: string;
  user_id: string;
  feedback_type: FeedbackType;
  false_positive_reason?: FalsePositiveReason;
  notes?: string;
  actual_configuration?: ActualConfiguration;
  submitted_at: number;
}

/**
 * What was actually configured (for false positives)
 */
export interface ActualConfiguration {
  services_disabled?: string[];
  firewall_rules_present?: boolean;
  protection_method?: string;
  interface_list_membership?: string[];
  service_address_restrictions?: Record<string, string>;
  [key: string]: any;
}

/**
 * Evidence collected during detection
 */
export interface DetectionEvidence {
  id?: number;
  issue_id: string;
  evidence_type: string;
  evidence_category: 'layer1' | 'layer2' | 'layer3' | 'layer4';
  confidence_contribution: number; // 0.0 - 1.0
  evidence_data: EvidenceData;
  collected_at: number;
}

export interface EvidenceData {
  source: string;
  verified: boolean;
  details: any;
  [key: string]: any;
}

/**
 * Service check evidence (Layer 1)
 */
export interface ServiceCheckEvidence extends EvidenceData {
  service_name: string;
  enabled: boolean;
  port: number;
  address_restriction?: string;
  available_from: string[];
  verification_method: 'api' | 'assumed';
}

/**
 * Firewall check evidence (Layer 2)
 */
export interface FirewallCheckEvidence extends EvidenceData {
  rules_analyzed: number;
  explicit_interface_rules: number;
  interface_list_rules: number;
  global_input_rules: number;
  has_effective_protection: boolean;
  interface_list_membership?: string[];
}

/**
 * Accessibility test evidence (Layer 3)
 */
export interface AccessibilityTestEvidence extends EvidenceData {
  service: string;
  port: number;
  accessible: boolean;
  test_method: 'external' | 'internal' | 'simulated';
  response: string;
}

/**
 * False positive pattern learned from feedback
 */
export interface FalsePositivePattern {
  id?: number;
  rule_name: string;
  pattern_type: string;
  occurrence_count: number;
  last_seen_at: number;
  pattern_data: PatternData;
  confidence: number;
  created_at: number;
}

export interface PatternData {
  description: string;
  conditions: Record<string, any>;
  [key: string]: any;
}

/**
 * Improvement rule generated from patterns
 */
export interface ImprovementRule {
  id?: number;
  rule_name: string;
  condition: 'before_detection' | 'during_detection' | 'after_detection';
  action: 'add_check' | 'reduce_confidence' | 'skip_detection' | 'change_severity';
  check_type?: string;
  parameters: RuleParameters;
  priority: number;
  evidence_count: number;
  enabled: boolean;
  created_at: number;
  last_applied_at?: number;
}

export interface RuleParameters {
  message?: string;
  multiplier?: number;
  new_severity?: string;
  check_details?: any;
  [key: string]: any;
}

/**
 * Learning metrics for a detection rule
 */
export interface LearningMetrics {
  id?: number;
  rule_name: string;
  period_start: number;
  period_end: number;
  total_detections: number;
  true_positives: number;
  false_positives: number;
  needs_investigation: number;
  false_positive_rate: number;
  accuracy: number;
  active_improvement_rules: number;
  created_at: number;
}

/**
 * Complete security analysis with all layers
 */
export interface SecurityAnalysis {
  rule_name: string;
  interface_name: string;
  timestamp: number;

  // Layer 1: Service status
  services: ServiceCheckEvidence[];
  services_verified: boolean;

  // Layer 2: Firewall rules
  firewall: FirewallCheckEvidence;
  firewall_verified: boolean;

  // Layer 3: Accessibility tests
  accessibility_tests: AccessibilityTestEvidence[];
  accessibility_tested: boolean;

  // Layer 4: Configuration verification
  has_full_config_access: boolean;
  config_verification_method: string;

  // Overall assessment
  has_vulnerability: boolean;
  confidence: number;
  all_evidence: DetectionEvidence[];
}

/**
 * Detection context for learning system
 */
export interface DetectionContext {
  rule_name: string;
  router_state: any;
  analysis: SecurityAnalysis;
  detected_issue: boolean;
  issue_id?: string;
  timestamp: number;
}

/**
 * Learning system statistics
 */
export interface LearningStat {
  rule_name: string;
  display_name: string;
  total_detections: number;
  false_positive_rate: number;
  improvement_rules: number;
  accuracy_improvement: number; // percentage
  last_updated: number;
}
