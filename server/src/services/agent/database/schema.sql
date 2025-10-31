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

-- ============================================================
-- Phase 2: Proactive Intelligence - Troubleshooting Sessions
-- ============================================================

-- Troubleshooting sessions table - track multi-step troubleshooting workflows
CREATE TABLE IF NOT EXISTS troubleshooting_sessions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  issue_id TEXT,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','resolved','escalated')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolution_summary TEXT,
  effectiveness TEXT CHECK(effectiveness IN ('fully_resolved','partially_resolved','unresolved')),
  resolution_time_minutes INTEGER,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_conversation ON troubleshooting_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sessions_issue ON troubleshooting_sessions(issue_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON troubleshooting_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON troubleshooting_sessions(created_at DESC);

-- Session steps table - detailed step-by-step actions in troubleshooting
CREATE TABLE IF NOT EXISTS session_steps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK(action_type IN ('tool_call','command','analysis','recommendation')),
  action_data TEXT,
  result TEXT NOT NULL CHECK(result IN ('success','failed','partial','pending')),
  timestamp INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (session_id) REFERENCES troubleshooting_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_steps_session ON session_steps(session_id, step_number);
CREATE INDEX IF NOT EXISTS idx_steps_timestamp ON session_steps(timestamp DESC);

-- ============================================================
-- Phase 3: Advanced Intelligence - Trend Analysis & Prediction
-- ============================================================

-- System metrics history table - time-series data for trend analysis
CREATE TABLE IF NOT EXISTS system_metrics_history (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON system_metrics_history(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON system_metrics_history(timestamp DESC);
