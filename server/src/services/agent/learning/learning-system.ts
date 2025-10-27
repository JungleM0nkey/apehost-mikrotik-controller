/**
 * False Positive Learning System
 * Analyzes feedback patterns and generates improvement rules
 */

import { getFeedbackDatabase } from '../database/feedback-db.js';
import type {
  IssueFeedback,
  FalsePositivePattern,
  ImprovementRule,
  LearningMetrics,
  PatternData,
  RuleParameters,
} from '../models/feedback-types.js';
import { getAgentDatabase } from '../database/agent-db.js';

export class LearningSystem {
  private feedbackDb = getFeedbackDatabase();
  private agentDb = getAgentDatabase();

  /**
   * Analyze feedback patterns for a specific rule
   * Generate improvement rules based on false positive patterns
   */
  async analyzeAndLearn(rule_name: string): Promise<{
    patterns: FalsePositivePattern[];
    rules: ImprovementRule[];
    metrics: LearningMetrics;
  }> {
    console.log(`[LearningSystem] Analyzing patterns for ${rule_name}`);

    // Get all detections for this rule
    const allIssues = this.agentDb.getIssues({});
    const ruleIssues = allIssues.filter((issue) =>
      issue.metadata?.rule_name === rule_name
    );

    // Get feedback for these issues
    const feedbackData: IssueFeedback[] = [];
    for (const issue of ruleIssues) {
      const feedback = this.feedbackDb.getFeedback(issue.id);
      if (feedback) {
        feedbackData.push(feedback);
      }
    }

    if (feedbackData.length === 0) {
      console.log(`[LearningSystem] No feedback data for ${rule_name}`);
      return {
        patterns: [],
        rules: [],
        metrics: this.createEmptyMetrics(rule_name),
      };
    }

    // Count feedback types
    const falsePositives = feedbackData.filter(
      (f) => f.feedback_type === 'false_positive'
    );
    const truePositives = feedbackData.filter(
      (f) => f.feedback_type === 'true_positive'
    );
    const needsInvestigation = feedbackData.filter(
      (f) => f.feedback_type === 'needs_investigation'
    );

    // Analyze false positive patterns
    const patterns = this.analyzeFalsePositivePatterns(rule_name, falsePositives);

    // Store patterns in database
    patterns.forEach((pattern) => {
      this.feedbackDb.createPattern(pattern);
    });

    // Generate improvement rules from patterns
    const rules = this.generateImprovementRules(rule_name, patterns, falsePositives);

    // Store improvement rules
    const createdRules: ImprovementRule[] = [];
    for (const rule of rules) {
      const created = this.feedbackDb.createImprovementRule(rule);
      createdRules.push(created);
    }

    // Calculate and store metrics
    const metrics = this.calculateMetrics(
      rule_name,
      feedbackData.length,
      truePositives.length,
      falsePositives.length,
      needsInvestigation.length,
      createdRules.length
    );
    this.feedbackDb.createLearningMetrics(metrics);

    return { patterns, rules: createdRules, metrics };
  }

  /**
   * Analyze false positive patterns
   */
  private analyzeFalsePositivePatterns(
    rule_name: string,
    falsePositives: IssueFeedback[]
  ): FalsePositivePattern[] {
    const patterns: Map<string, FalsePositivePattern> = new Map();

    falsePositives.forEach((fp) => {
      if (!fp.false_positive_reason) return;

      const key = `${rule_name}-${fp.false_positive_reason}`;
      const existing = patterns.get(key);

      if (existing) {
        existing.occurrence_count++;
        existing.last_seen_at = fp.submitted_at;
        existing.confidence = Math.min(
          1.0,
          existing.confidence + 0.1 // Increase confidence with each occurrence
        );
      } else {
        patterns.set(key, {
          rule_name,
          pattern_type: fp.false_positive_reason,
          occurrence_count: 1,
          last_seen_at: fp.submitted_at,
          pattern_data: this.extractPatternData(fp),
          confidence: 0.5,
          created_at: Date.now(),
        });
      }
    });

    return Array.from(patterns.values());
  }

  /**
   * Extract pattern data from feedback
   */
  private extractPatternData(feedback: IssueFeedback): PatternData {
    const data: PatternData = {
      description: this.getPatternDescription(feedback.false_positive_reason!),
      conditions: {},
    };

    if (feedback.actual_configuration) {
      data.conditions = feedback.actual_configuration;
    }

    return data;
  }

  /**
   * Generate improvement rules from patterns
   */
  private generateImprovementRules(
    rule_name: string,
    patterns: FalsePositivePattern[],
    falsePositives: IssueFeedback[]
  ): Omit<ImprovementRule, 'id'>[] {
    const rules: Omit<ImprovementRule, 'id'>[] = [];
    const totalFP = falsePositives.length;

    patterns.forEach((pattern) => {
      const threshold = 0.3; // 30% of false positives
      const ratio = pattern.occurrence_count / totalFP;

      if (ratio > threshold) {
        const rule = this.createRuleFromPattern(
          rule_name,
          pattern,
          pattern.occurrence_count
        );
        if (rule) {
          rules.push(rule);
        }
      }
    });

    return rules;
  }

  /**
   * Create improvement rule from pattern
   */
  private createRuleFromPattern(
    rule_name: string,
    pattern: FalsePositivePattern,
    evidence_count: number
  ): Omit<ImprovementRule, 'id'> | null {
    switch (pattern.pattern_type) {
      case 'services_disabled':
        return {
          rule_name,
          condition: 'before_detection',
          action: 'add_check',
          check_type: 'verify_services_enabled',
          parameters: {
            message: 'Check service status before flagging firewall issue',
            check_details: pattern.pattern_data,
          },
          priority: 1,
          evidence_count,
          enabled: true,
          created_at: Date.now(),
        };

      case 'interface_list_protection':
        return {
          rule_name,
          condition: 'during_detection',
          action: 'add_check',
          check_type: 'verify_interface_list_rules',
          parameters: {
            message: 'Check interface list membership and rules',
            check_details: pattern.pattern_data,
          },
          priority: 1,
          evidence_count,
          enabled: true,
          created_at: Date.now(),
        };

      case 'services_restricted':
        return {
          rule_name,
          condition: 'during_detection',
          action: 'add_check',
          check_type: 'verify_service_restrictions',
          parameters: {
            message: 'Check service address restrictions',
            check_details: pattern.pattern_data,
          },
          priority: 1,
          evidence_count,
          enabled: true,
          created_at: Date.now(),
        };

      case 'upstream_firewall':
      case 'other_protection_method':
        return {
          rule_name,
          condition: 'after_detection',
          action: 'reduce_confidence',
          parameters: {
            message: `This detection has ${evidence_count} reports of ${pattern.pattern_type}`,
            multiplier: 0.7,
          },
          priority: 2,
          evidence_count,
          enabled: true,
          created_at: Date.now(),
        };

      default:
        return null;
    }
  }

  /**
   * Calculate learning metrics
   */
  private calculateMetrics(
    rule_name: string,
    total: number,
    truePositives: number,
    falsePositives: number,
    needsInvestigation: number,
    activeRules: number
  ): LearningMetrics {
    const fpRate = total > 0 ? falsePositives / total : 0;
    const accuracy = total > 0 ? truePositives / total : 0;

    return {
      rule_name,
      period_start: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
      period_end: Date.now(),
      total_detections: total,
      true_positives: truePositives,
      false_positives: falsePositives,
      needs_investigation: needsInvestigation,
      false_positive_rate: fpRate,
      accuracy,
      active_improvement_rules: activeRules,
      created_at: Date.now(),
    };
  }

  /**
   * Create empty metrics for rules with no feedback
   */
  private createEmptyMetrics(rule_name: string): LearningMetrics {
    return {
      rule_name,
      period_start: Date.now(),
      period_end: Date.now(),
      total_detections: 0,
      true_positives: 0,
      false_positives: 0,
      needs_investigation: 0,
      false_positive_rate: 0,
      accuracy: 0,
      active_improvement_rules: 0,
      created_at: Date.now(),
    };
  }

  /**
   * Get pattern description
   */
  private getPatternDescription(reason: string): string {
    const descriptions: Record<string, string> = {
      services_disabled: 'Management services are disabled in configuration',
      services_restricted: 'Services are restricted to LAN addresses only',
      interface_list_protection: 'Firewall uses interface lists instead of explicit names',
      upstream_firewall: 'Protected by upstream firewall or router',
      other_protection_method: 'Other protection method in place',
      incorrect_interface_type: 'Interface was misidentified as WAN',
      already_fixed: 'Issue was already fixed before detection',
    };
    return descriptions[reason] || 'Unknown pattern';
  }

  /**
   * Apply improvement rules to a detection
   * Returns true if detection should be skipped
   */
  async applyImprovementRules(
    rule_name: string,
    detectionData: any
  ): Promise<{
    skip: boolean;
    adjustments: { confidence?: number; severity?: string };
    messages: string[];
  }> {
    const rules = this.feedbackDb.getImprovementRules(rule_name);
    const result = {
      skip: false,
      adjustments: {} as { confidence?: number; severity?: string },
      messages: [] as string[],
    };

    for (const rule of rules) {
      // Update last applied timestamp
      if (rule.id) {
        this.feedbackDb.updateRuleLastApplied(rule.id);
      }

      switch (rule.action) {
        case 'skip_detection':
          result.skip = true;
          result.messages.push(rule.parameters.message || 'Detection skipped');
          break;

        case 'reduce_confidence':
          if (rule.parameters.multiplier) {
            result.adjustments.confidence =
              (result.adjustments.confidence || 1.0) * rule.parameters.multiplier;
            result.messages.push(rule.parameters.message || 'Confidence reduced');
          }
          break;

        case 'change_severity':
          if (rule.parameters.new_severity) {
            result.adjustments.severity = rule.parameters.new_severity;
            result.messages.push(
              rule.parameters.message || 'Severity adjusted based on patterns'
            );
          }
          break;

        case 'add_check':
          result.messages.push(
            rule.parameters.message || 'Additional checks should be performed'
          );
          break;
      }
    }

    return result;
  }
}

// Singleton instance
let instance: LearningSystem | null = null;

export function getLearningSystem(): LearningSystem {
  if (!instance) {
    instance = new LearningSystem();
  }
  return instance;
}
