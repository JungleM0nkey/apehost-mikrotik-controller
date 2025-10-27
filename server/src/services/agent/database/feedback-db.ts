/**
 * Feedback Database Operations
 * Extends AgentDatabase with feedback and learning system operations
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAgentDatabase, AgentDatabase } from './agent-db.js';
import type {
  IssueFeedback,
  DetectionEvidence,
  FalsePositivePattern,
  ImprovementRule,
  LearningMetrics,
  LearningStat,
} from '../models/feedback-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class FeedbackDatabase {
  private db: Database.Database;
  private agentDb: AgentDatabase;

  constructor() {
    this.agentDb = getAgentDatabase();
    this.db = (this.agentDb as any).db; // Access underlying SQLite database
    this.runMigrations();
  }

  /**
   * Run feedback system migrations
   */
  private runMigrations(): void {
    const migrationPath = join(__dirname, 'migrations', '001_feedback_system.sql');

    if (existsSync(migrationPath)) {
      try {
        const migration = readFileSync(migrationPath, 'utf-8');
        this.db.exec(migration);
        console.log('[FeedbackDB] Feedback system migrations applied');
      } catch (error) {
        console.error('[FeedbackDB] Migration failed:', error);
      }
    }
  }

  // ============ Feedback Operations ============

  createFeedback(feedback: Omit<IssueFeedback, 'id'>): IssueFeedback {
    const id = randomUUID();
    const fullFeedback: IssueFeedback = { ...feedback, id };

    const stmt = this.db.prepare(`
      INSERT INTO issue_feedback (
        id, issue_id, user_id, feedback_type, false_positive_reason,
        notes, actual_configuration, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullFeedback.id,
      fullFeedback.issue_id,
      fullFeedback.user_id,
      fullFeedback.feedback_type,
      fullFeedback.false_positive_reason || null,
      fullFeedback.notes || null,
      fullFeedback.actual_configuration
        ? JSON.stringify(fullFeedback.actual_configuration)
        : null,
      fullFeedback.submitted_at
    );

    return fullFeedback;
  }

  getFeedback(issue_id: string): IssueFeedback | null {
    const stmt = this.db.prepare('SELECT * FROM issue_feedback WHERE issue_id = ?');
    const row = stmt.get(issue_id) as any;
    return row ? this.parseFeedbackRow(row) : null;
  }

  getAllFeedback(filters?: {
    feedback_type?: string;
    limit?: number;
  }): IssueFeedback[] {
    let query = 'SELECT * FROM issue_feedback WHERE 1=1';
    const params: any[] = [];

    if (filters?.feedback_type) {
      query += ' AND feedback_type = ?';
      params.push(filters.feedback_type);
    }

    query += ' ORDER BY submitted_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => this.parseFeedbackRow(row));
  }

  // ============ Detection Evidence Operations ============

  createEvidence(evidence: Omit<DetectionEvidence, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO detection_evidence (
        issue_id, evidence_type, evidence_category,
        confidence_contribution, evidence_data, collected_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      evidence.issue_id,
      evidence.evidence_type,
      evidence.evidence_category,
      evidence.confidence_contribution,
      JSON.stringify(evidence.evidence_data),
      evidence.collected_at
    );
  }

  getEvidence(issue_id: string): DetectionEvidence[] {
    const stmt = this.db.prepare(`
      SELECT * FROM detection_evidence
      WHERE issue_id = ?
      ORDER BY collected_at DESC
    `);
    const rows = stmt.all(issue_id) as any[];
    return rows.map((row) => this.parseEvidenceRow(row));
  }

  // ============ False Positive Pattern Operations ============

  createPattern(pattern: Omit<FalsePositivePattern, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO false_positive_patterns (
        rule_name, pattern_type, occurrence_count, last_seen_at,
        pattern_data, confidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(rule_name, pattern_type, pattern_data) DO UPDATE SET
        occurrence_count = occurrence_count + 1,
        last_seen_at = excluded.last_seen_at,
        confidence = excluded.confidence
    `);

    stmt.run(
      pattern.rule_name,
      pattern.pattern_type,
      pattern.occurrence_count,
      pattern.last_seen_at,
      JSON.stringify(pattern.pattern_data),
      pattern.confidence,
      pattern.created_at
    );
  }

  getPatterns(rule_name: string): FalsePositivePattern[] {
    const stmt = this.db.prepare(`
      SELECT * FROM false_positive_patterns
      WHERE rule_name = ?
      ORDER BY occurrence_count DESC
    `);
    const rows = stmt.all(rule_name) as any[];
    return rows.map((row) => this.parsePatternRow(row));
  }

  // ============ Improvement Rule Operations ============

  createImprovementRule(rule: Omit<ImprovementRule, 'id'>): ImprovementRule {
    const stmt = this.db.prepare(`
      INSERT INTO improvement_rules (
        rule_name, condition, action, check_type, parameters,
        priority, evidence_count, enabled, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      rule.rule_name,
      rule.condition,
      rule.action,
      rule.check_type || null,
      JSON.stringify(rule.parameters),
      rule.priority,
      rule.evidence_count,
      rule.enabled ? 1 : 0,
      rule.created_at
    );

    return { ...rule, id: result.lastInsertRowid as number };
  }

  getImprovementRules(rule_name: string): ImprovementRule[] {
    const stmt = this.db.prepare(`
      SELECT * FROM improvement_rules
      WHERE rule_name = ? AND enabled = 1
      ORDER BY priority DESC
    `);
    const rows = stmt.all(rule_name) as any[];
    return rows.map((row) => this.parseImprovementRuleRow(row));
  }

  updateRuleLastApplied(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE improvement_rules
      SET last_applied_at = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  // ============ Learning Metrics Operations ============

  createLearningMetrics(metrics: Omit<LearningMetrics, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO learning_metrics (
        rule_name, period_start, period_end, total_detections,
        true_positives, false_positives, needs_investigation,
        false_positive_rate, accuracy, active_improvement_rules, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metrics.rule_name,
      metrics.period_start,
      metrics.period_end,
      metrics.total_detections,
      metrics.true_positives,
      metrics.false_positives,
      metrics.needs_investigation,
      metrics.false_positive_rate,
      metrics.accuracy,
      metrics.active_improvement_rules,
      metrics.created_at
    );
  }

  getLearningMetrics(rule_name: string, limit = 10): LearningMetrics[] {
    const stmt = this.db.prepare(`
      SELECT * FROM learning_metrics
      WHERE rule_name = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(rule_name, limit) as any[];
    return rows.map((row) => this.parseLearningMetricsRow(row));
  }

  /**
   * Get learning statistics for all rules
   */
  getLearningStats(): LearningStat[] {
    const stmt = this.db.prepare(`
      WITH latest_metrics AS (
        SELECT DISTINCT rule_name,
          (SELECT false_positive_rate FROM learning_metrics lm2
           WHERE lm2.rule_name = learning_metrics.rule_name
           ORDER BY created_at DESC LIMIT 1) as fp_rate,
          (SELECT accuracy FROM learning_metrics lm2
           WHERE lm2.rule_name = learning_metrics.rule_name
           ORDER BY created_at DESC LIMIT 1) as current_accuracy,
          (SELECT accuracy FROM learning_metrics lm2
           WHERE lm2.rule_name = learning_metrics.rule_name
           ORDER BY created_at ASC LIMIT 1) as initial_accuracy,
          (SELECT active_improvement_rules FROM learning_metrics lm2
           WHERE lm2.rule_name = learning_metrics.rule_name
           ORDER BY created_at DESC LIMIT 1) as rules_count,
          (SELECT SUM(total_detections) FROM learning_metrics lm2
           WHERE lm2.rule_name = learning_metrics.rule_name) as total_dets,
          (SELECT MAX(created_at) FROM learning_metrics lm2
           WHERE lm2.rule_name = learning_metrics.rule_name) as last_update
        FROM learning_metrics
      )
      SELECT * FROM latest_metrics
    `);

    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      rule_name: row.rule_name,
      display_name: this.formatRuleName(row.rule_name),
      total_detections: row.total_dets || 0,
      false_positive_rate: row.fp_rate || 0,
      improvement_rules: row.rules_count || 0,
      accuracy_improvement: ((row.current_accuracy || 0) - (row.initial_accuracy || 0)) * 100,
      last_updated: row.last_update,
    }));
  }

  // ============ Helper Methods ============

  private parseFeedbackRow(row: any): IssueFeedback {
    return {
      id: row.id,
      issue_id: row.issue_id,
      user_id: row.user_id,
      feedback_type: row.feedback_type,
      false_positive_reason: row.false_positive_reason,
      notes: row.notes,
      actual_configuration: row.actual_configuration
        ? JSON.parse(row.actual_configuration)
        : undefined,
      submitted_at: row.submitted_at,
    };
  }

  private parseEvidenceRow(row: any): DetectionEvidence {
    return {
      id: row.id,
      issue_id: row.issue_id,
      evidence_type: row.evidence_type,
      evidence_category: row.evidence_category,
      confidence_contribution: row.confidence_contribution,
      evidence_data: JSON.parse(row.evidence_data),
      collected_at: row.collected_at,
    };
  }

  private parsePatternRow(row: any): FalsePositivePattern {
    return {
      id: row.id,
      rule_name: row.rule_name,
      pattern_type: row.pattern_type,
      occurrence_count: row.occurrence_count,
      last_seen_at: row.last_seen_at,
      pattern_data: JSON.parse(row.pattern_data),
      confidence: row.confidence,
      created_at: row.created_at,
    };
  }

  private parseImprovementRuleRow(row: any): ImprovementRule {
    return {
      id: row.id,
      rule_name: row.rule_name,
      condition: row.condition,
      action: row.action,
      check_type: row.check_type,
      parameters: JSON.parse(row.parameters),
      priority: row.priority,
      evidence_count: row.evidence_count,
      enabled: row.enabled === 1,
      created_at: row.created_at,
      last_applied_at: row.last_applied_at,
    };
  }

  private parseLearningMetricsRow(row: any): LearningMetrics {
    return {
      id: row.id,
      rule_name: row.rule_name,
      period_start: row.period_start,
      period_end: row.period_end,
      total_detections: row.total_detections,
      true_positives: row.true_positives,
      false_positives: row.false_positives,
      needs_investigation: row.needs_investigation,
      false_positive_rate: row.false_positive_rate,
      accuracy: row.accuracy,
      active_improvement_rules: row.active_improvement_rules,
      created_at: row.created_at,
    };
  }

  private formatRuleName(rule_name: string): string {
    return rule_name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Singleton instance
let instance: FeedbackDatabase | null = null;

export function getFeedbackDatabase(): FeedbackDatabase {
  if (!instance) {
    instance = new FeedbackDatabase();
  }
  return instance;
}
