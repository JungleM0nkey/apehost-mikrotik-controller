import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import type {
  Issue,
  MetricsSnapshot,
  DetectionResult,
  TroubleshootingSession,
  SessionStep,
  SessionSeverity,
  SessionStatus,
  SessionEffectiveness,
  StepActionType,
  StepResult,
  MetricDataPoint,
} from '../models/types.js';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AgentDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || join(process.cwd(), 'data', 'agent.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance for concurrent access
    this.initialize();
  }

  private initialize(): void {
    // Read and execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
    console.log(`[AgentDB] Database initialized at ${this.dbPath}`);
  }

  // ============ Issue Operations ============

  createIssue(issue: Omit<Issue, 'id'>): Issue {
    const id = randomUUID();
    const fullIssue: Issue = { ...issue, id };

    const stmt = this.db.prepare(`
      INSERT INTO issues (
        id, detected_at, resolved_at, severity, category,
        title, description, recommendation, status,
        confidence_score, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullIssue.id,
      fullIssue.detected_at,
      fullIssue.resolved_at || null,
      fullIssue.severity,
      fullIssue.category,
      fullIssue.title,
      fullIssue.description,
      fullIssue.recommendation || null,
      fullIssue.status,
      fullIssue.confidence_score,
      fullIssue.metadata ? JSON.stringify(fullIssue.metadata) : null
    );

    return fullIssue;
  }

  getIssue(id: string): Issue | null {
    const stmt = this.db.prepare('SELECT * FROM issues WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.parseIssueRow(row) : null;
  }

  getIssues(filters?: {
    status?: string;
    severity?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Issue[] {
    let query = 'SELECT * FROM issues WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.severity) {
      query += ' AND severity = ?';
      params.push(filters.severity);
    }
    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    query += ' ORDER BY detected_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => this.parseIssueRow(row));
  }

  updateIssueStatus(id: string, status: string, resolved_at?: number): void {
    const stmt = this.db.prepare(`
      UPDATE issues
      SET status = ?, resolved_at = ?
      WHERE id = ?
    `);
    stmt.run(status, resolved_at || null, id);
  }

  findSimilarIssue(title: string, category: string): Issue | null {
    const stmt = this.db.prepare(`
      SELECT * FROM issues
      WHERE title = ? AND category = ? AND status = 'detected'
      ORDER BY detected_at DESC
      LIMIT 1
    `);
    const row = stmt.get(title, category) as any;
    return row ? this.parseIssueRow(row) : null;
  }

  getIssueCounts(): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT severity, COUNT(*) as count
      FROM issues
      WHERE status = 'detected'
      GROUP BY severity
    `);
    const rows = stmt.all() as any[];
    return rows.reduce((acc, row) => {
      acc[row.severity] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }

  // ============ Metrics Operations ============

  createMetricsSnapshot(metrics: Omit<MetricsSnapshot, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO metrics_snapshots (
        collected_at, cpu_usage, memory_usage, disk_usage,
        uptime, connection_count, interface_stats
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metrics.collected_at,
      metrics.cpu_usage || null,
      metrics.memory_usage || null,
      metrics.disk_usage || null,
      metrics.uptime || null,
      metrics.connection_count || null,
      metrics.interface_stats ? JSON.stringify(metrics.interface_stats) : null
    );
  }

  getRecentMetrics(hours = 24): MetricsSnapshot[] {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    const stmt = this.db.prepare(`
      SELECT * FROM metrics_snapshots
      WHERE collected_at > ?
      ORDER BY collected_at DESC
    `);
    const rows = stmt.all(cutoffTime) as any[];
    return rows.map((row) => this.parseMetricsRow(row));
  }

  getAverageMetrics(hours = 24): Partial<MetricsSnapshot> {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    const stmt = this.db.prepare(`
      SELECT
        AVG(cpu_usage) as avg_cpu,
        AVG(memory_usage) as avg_memory,
        AVG(disk_usage) as avg_disk
      FROM metrics_snapshots
      WHERE collected_at > ?
    `);
    const row = stmt.get(cutoffTime) as any;
    return {
      cpu_usage: row.avg_cpu || 0,
      memory_usage: row.avg_memory || 0,
      disk_usage: row.avg_disk || 0,
    };
  }

  // ============ Detection History ============

  recordDetection(result: DetectionResult, issue_id?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO detection_history (
        rule_name, ran_at, detected_issue, issue_id, execution_time_ms
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      result.rule_name,
      Date.now(),
      result.issue ? 1 : 0,
      issue_id || null,
      result.execution_time_ms
    );
  }

  // ============ Troubleshooting Session Operations (Phase 2) ============

  createSession(session: Omit<TroubleshootingSession, 'id' | 'created_at' | 'updated_at'>): TroubleshootingSession {
    const id = randomUUID();
    const now = Date.now();
    const fullSession: TroubleshootingSession = {
      ...session,
      id,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO troubleshooting_sessions (
        id, conversation_id, issue_id, description, severity,
        status, created_at, updated_at, resolved_at, resolution_summary,
        effectiveness, resolution_time_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullSession.id,
      fullSession.conversation_id,
      fullSession.issue_id || null,
      fullSession.description,
      fullSession.severity,
      fullSession.status,
      fullSession.created_at,
      fullSession.updated_at,
      fullSession.resolved_at || null,
      fullSession.resolution_summary || null,
      fullSession.effectiveness || null,
      fullSession.resolution_time_minutes || null
    );

    return fullSession;
  }

  getSession(id: string): TroubleshootingSession | null {
    const stmt = this.db.prepare('SELECT * FROM troubleshooting_sessions WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.parseSessionRow(row) : null;
  }

  getSessions(filters?: {
    conversation_id?: string;
    issue_id?: string;
    status?: SessionStatus;
    severity?: SessionSeverity;
    limit?: number;
    offset?: number;
  }): TroubleshootingSession[] {
    let query = 'SELECT * FROM troubleshooting_sessions WHERE 1=1';
    const params: any[] = [];

    if (filters?.conversation_id) {
      query += ' AND conversation_id = ?';
      params.push(filters.conversation_id);
    }
    if (filters?.issue_id) {
      query += ' AND issue_id = ?';
      params.push(filters.issue_id);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.severity) {
      query += ' AND severity = ?';
      params.push(filters.severity);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.parseSessionRow(row));
  }

  updateSession(id: string, updates: Partial<Omit<TroubleshootingSession, 'id' | 'created_at'>>): void {
    const session = this.getSession(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const fields: string[] = [];
    const values: any[] = [];

    // Always update updated_at
    fields.push('updated_at = ?');
    values.push(Date.now());

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.severity !== undefined) {
      fields.push('severity = ?');
      values.push(updates.severity);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.resolved_at !== undefined) {
      fields.push('resolved_at = ?');
      values.push(updates.resolved_at);
    }
    if (updates.resolution_summary !== undefined) {
      fields.push('resolution_summary = ?');
      values.push(updates.resolution_summary);
    }
    if (updates.effectiveness !== undefined) {
      fields.push('effectiveness = ?');
      values.push(updates.effectiveness);
    }
    if (updates.resolution_time_minutes !== undefined) {
      fields.push('resolution_time_minutes = ?');
      values.push(updates.resolution_time_minutes);
    }

    if (fields.length === 1) return; // Only updated_at, no need to update

    values.push(id);
    const query = `UPDATE troubleshooting_sessions SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...values);
  }

  resolveSession(
    id: string,
    resolution_summary: string,
    effectiveness: SessionEffectiveness
  ): void {
    const session = this.getSession(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const resolved_at = Date.now();
    const resolution_time_minutes = Math.floor((resolved_at - session.created_at) / 60000);

    this.updateSession(id, {
      status: 'resolved',
      resolved_at,
      resolution_summary,
      effectiveness,
      resolution_time_minutes,
    });
  }

  // ============ Session Step Operations (Phase 2) ============

  addSessionStep(step: Omit<SessionStep, 'id' | 'timestamp'>): SessionStep {
    const id = randomUUID();
    const fullStep: SessionStep = {
      ...step,
      id,
      timestamp: Date.now(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO session_steps (
        id, session_id, step_number, description, action_type,
        action_data, result, timestamp, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullStep.id,
      fullStep.session_id,
      fullStep.step_number,
      fullStep.description,
      fullStep.action_type,
      fullStep.action_data ? JSON.stringify(fullStep.action_data) : null,
      fullStep.result,
      fullStep.timestamp,
      fullStep.notes || null
    );

    // Update session updated_at
    this.updateSession(fullStep.session_id, {});

    return fullStep;
  }

  getSessionSteps(session_id: string): SessionStep[] {
    const stmt = this.db.prepare(`
      SELECT * FROM session_steps
      WHERE session_id = ?
      ORDER BY step_number ASC
    `);
    const rows = stmt.all(session_id) as any[];
    return rows.map(row => this.parseStepRow(row));
  }

  getNextStepNumber(session_id: string): number {
    const stmt = this.db.prepare(`
      SELECT MAX(step_number) as max_step
      FROM session_steps
      WHERE session_id = ?
    `);
    const result = stmt.get(session_id) as any;
    return (result?.max_step || 0) + 1;
  }

  // ============ Helper Methods ============

  private parseIssueRow(row: any): Issue {
    return {
      id: row.id,
      detected_at: row.detected_at,
      resolved_at: row.resolved_at,
      severity: row.severity,
      category: row.category,
      title: row.title,
      description: row.description,
      recommendation: row.recommendation,
      status: row.status,
      confidence_score: row.confidence_score,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private parseMetricsRow(row: any): MetricsSnapshot {
    return {
      id: row.id,
      collected_at: row.collected_at,
      cpu_usage: row.cpu_usage,
      memory_usage: row.memory_usage,
      disk_usage: row.disk_usage,
      uptime: row.uptime,
      connection_count: row.connection_count,
      interface_stats: row.interface_stats ? JSON.parse(row.interface_stats) : undefined,
    };
  }

  private parseSessionRow(row: any): TroubleshootingSession {
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      issue_id: row.issue_id,
      description: row.description,
      severity: row.severity,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,
      resolution_summary: row.resolution_summary,
      effectiveness: row.effectiveness,
      resolution_time_minutes: row.resolution_time_minutes,
    };
  }

  private parseStepRow(row: any): SessionStep {
    return {
      id: row.id,
      session_id: row.session_id,
      step_number: row.step_number,
      description: row.description,
      action_type: row.action_type,
      action_data: row.action_data ? JSON.parse(row.action_data) : undefined,
      result: row.result,
      timestamp: row.timestamp,
      notes: row.notes,
    };
  }

  // ============ Phase 3: Metrics History Operations ============

  recordMetric(
    metric_name: string,
    metric_value: number,
    metadata?: Record<string, unknown>
  ): MetricDataPoint {
    const id = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO system_metrics_history (id, metric_name, metric_value, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      metric_name,
      metric_value,
      timestamp,
      metadata ? JSON.stringify(metadata) : null
    );

    return {
      id,
      metric_name,
      metric_value,
      timestamp,
      metadata,
    };
  }

  getMetricsHistory(
    metric_name: string,
    since?: number,
    limit?: number
  ): MetricDataPoint[] {
    let query = `
      SELECT * FROM system_metrics_history
      WHERE metric_name = ?
    `;
    const params: any[] = [metric_name];

    if (since) {
      query += ` AND timestamp >= ?`;
      params.push(since);
    }

    query += ` ORDER BY timestamp DESC`;

    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.parseMetricDataPoint(row));
  }

  getMetricNames(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT metric_name
      FROM system_metrics_history
      ORDER BY metric_name ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map(row => row.metric_name);
  }

  cleanOldMetrics(older_than: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM system_metrics_history
      WHERE timestamp < ?
    `);
    const result = stmt.run(older_than);
    return result.changes;
  }

  private parseMetricDataPoint(row: any): MetricDataPoint {
    return {
      id: row.id,
      metric_name: row.metric_name,
      metric_value: row.metric_value,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  // ============ Effectiveness Analysis (Phase 3.3) ============

  /**
   * Get effectiveness analysis aggregated by resolution approach
   * Phase 3.3: Resolution Effectiveness Tracking
   */
  getEffectivenessAnalysis(timeframe_days: number = 30): Array<{
    approach: string;
    total_attempts: number;
    fully_resolved: number;
    partially_resolved: number;
    unresolved: number;
    success_rate: number;
    avg_resolution_time_minutes: number;
    avg_steps: number;
  }> {
    const since = Date.now() - (timeframe_days * 24 * 60 * 60 * 1000);

    // Get all resolved sessions in timeframe
    const sessions = this.getSessions({ status: 'resolved' })
      .filter(s => s.created_at >= since && s.resolution_summary);

    // Group by resolution approach keywords
    const approaches = new Map<string, Array<{
      effectiveness: SessionEffectiveness;
      resolution_time_minutes: number;
      steps_count: number;
    }>>();

    const keywords = ['restart', 'reset', 'clear', 'update', 'configure', 'check', 'analyze', 'fix', 'disable', 'enable', 'firewall', 'route', 'interface'];

    for (const session of sessions) {
      const summary = session.resolution_summary!.toLowerCase();
      const steps = this.getSessionSteps(session.id);

      for (const keyword of keywords) {
        if (summary.includes(keyword)) {
          if (!approaches.has(keyword)) {
            approaches.set(keyword, []);
          }
          approaches.get(keyword)!.push({
            effectiveness: session.effectiveness || 'unresolved',
            resolution_time_minutes: session.resolution_time_minutes || 0,
            steps_count: steps.length,
          });
        }
      }
    }

    // Calculate statistics for each approach
    const results = [];
    for (const [approach, sessions] of approaches.entries()) {
      const fully_resolved = sessions.filter(s => s.effectiveness === 'fully_resolved').length;
      const partially_resolved = sessions.filter(s => s.effectiveness === 'partially_resolved').length;
      const unresolved = sessions.filter(s => s.effectiveness === 'unresolved').length;
      const total_attempts = sessions.length;

      const avg_resolution_time_minutes = sessions.length > 0
        ? Math.round(sessions.reduce((sum, s) => sum + s.resolution_time_minutes, 0) / sessions.length)
        : 0;

      const avg_steps = sessions.length > 0
        ? Math.round(sessions.reduce((sum, s) => sum + s.steps_count, 0) / sessions.length)
        : 0;

      const success_rate = total_attempts > 0
        ? fully_resolved / total_attempts
        : 0;

      results.push({
        approach,
        total_attempts,
        fully_resolved,
        partially_resolved,
        unresolved,
        success_rate,
        avg_resolution_time_minutes,
        avg_steps,
      });
    }

    // Sort by success rate descending, then by total attempts
    return results.sort((a, b) => {
      if (a.success_rate !== b.success_rate) {
        return b.success_rate - a.success_rate;
      }
      return b.total_attempts - a.total_attempts;
    });
  }

  /**
   * Get overall resolution effectiveness statistics
   * Phase 3.3: Resolution Effectiveness Tracking
   */
  getOverallEffectiveness(timeframe_days: number = 30): {
    total_sessions: number;
    resolved_sessions: number;
    active_sessions: number;
    effectiveness_breakdown: {
      fully_resolved: number;
      partially_resolved: number;
      unresolved: number;
    };
    avg_resolution_time_minutes: number;
    avg_steps_per_session: number;
    overall_success_rate: number;
  } {
    const since = Date.now() - (timeframe_days * 24 * 60 * 60 * 1000);
    const all_sessions = this.getSessions({}).filter(s => s.created_at >= since);
    const resolved = all_sessions.filter(s => s.status === 'resolved');

    const fully_resolved = resolved.filter(s => s.effectiveness === 'fully_resolved').length;
    const partially_resolved = resolved.filter(s => s.effectiveness === 'partially_resolved').length;
    const unresolved = resolved.filter(s => s.effectiveness === 'unresolved').length;

    const sessions_with_time = resolved.filter(s => s.resolution_time_minutes);
    const avg_resolution_time_minutes = sessions_with_time.length > 0
      ? Math.round(sessions_with_time.reduce((sum, s) => sum + (s.resolution_time_minutes || 0), 0) / sessions_with_time.length)
      : 0;

    // Calculate average steps
    let total_steps = 0;
    for (const session of resolved) {
      const steps = this.getSessionSteps(session.id);
      total_steps += steps.length;
    }
    const avg_steps_per_session = resolved.length > 0
      ? Math.round(total_steps / resolved.length)
      : 0;

    const overall_success_rate = resolved.length > 0
      ? fully_resolved / resolved.length
      : 0;

    return {
      total_sessions: all_sessions.length,
      resolved_sessions: resolved.length,
      active_sessions: all_sessions.filter(s => s.status === 'active').length,
      effectiveness_breakdown: {
        fully_resolved,
        partially_resolved,
        unresolved,
      },
      avg_resolution_time_minutes,
      avg_steps_per_session,
      overall_success_rate,
    };
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let instance: AgentDatabase | null = null;

export function getAgentDatabase(): AgentDatabase {
  if (!instance) {
    instance = new AgentDatabase();
  }
  return instance;
}
