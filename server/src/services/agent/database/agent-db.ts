import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import type { Issue, MetricsSnapshot, DetectionResult } from '../models/types.js';
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
