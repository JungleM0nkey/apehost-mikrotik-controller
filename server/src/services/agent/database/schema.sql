-- Agent Database Schema
-- SQLite database for autonomous agent system

-- Issues table - core issue tracking
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  detected_at INTEGER NOT NULL,
  resolved_at INTEGER,
  severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low')),
  category TEXT NOT NULL CHECK(category IN ('security','performance','stability','configuration')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'detected' CHECK(status IN ('detected','investigating','resolved','ignored')),
  confidence_score REAL DEFAULT 0.9,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_detected_at ON issues(detected_at DESC);

-- Metrics snapshots table - time-series performance data
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collected_at INTEGER NOT NULL,
  cpu_usage REAL,
  memory_usage REAL,
  disk_usage REAL,
  uptime INTEGER,
  connection_count INTEGER,
  interface_stats TEXT
);

CREATE INDEX IF NOT EXISTS idx_metrics_time ON metrics_snapshots(collected_at DESC);

-- Detection history table - track rule executions
CREATE TABLE IF NOT EXISTS detection_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL,
  ran_at INTEGER NOT NULL,
  detected_issue BOOLEAN NOT NULL,
  issue_id TEXT,
  execution_time_ms INTEGER,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);

CREATE INDEX IF NOT EXISTS idx_detection_history_time ON detection_history(ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_detection_history_rule ON detection_history(rule_name);

-- Migrations table - track schema versions
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
