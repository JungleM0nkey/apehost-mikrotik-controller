-- Migration 001: Feedback and Learning System
-- Adds tables for false positive tracking and learning

-- Issue Feedback table - Store user feedback on detections
CREATE TABLE IF NOT EXISTS issue_feedback (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK(feedback_type IN ('true_positive','false_positive','needs_investigation')),
  false_positive_reason TEXT CHECK(false_positive_reason IN (
    'services_disabled',
    'services_restricted',
    'interface_list_protection',
    'upstream_firewall',
    'other_protection_method',
    'incorrect_interface_type',
    'already_fixed',
    NULL
  )),
  notes TEXT,
  actual_configuration TEXT, -- JSON storing what was actually configured
  submitted_at INTEGER NOT NULL,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_issue ON issue_feedback(issue_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON issue_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_time ON issue_feedback(submitted_at DESC);

-- Detection Evidence table - Store evidence collected during detection
CREATE TABLE IF NOT EXISTS detection_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL, -- 'service_check', 'firewall_rule', 'accessibility_test', etc.
  evidence_category TEXT NOT NULL, -- 'layer1', 'layer2', 'layer3', 'layer4'
  confidence_contribution REAL NOT NULL, -- How much this evidence contributed to confidence
  evidence_data TEXT NOT NULL, -- JSON with specific evidence details
  collected_at INTEGER NOT NULL,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_issue ON detection_evidence(issue_id);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON detection_evidence(evidence_type);

-- False Positive Patterns table - Learned patterns from feedback
CREATE TABLE IF NOT EXISTS false_positive_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL,
  pattern_type TEXT NOT NULL, -- 'service_disabled', 'interface_list', etc.
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  last_seen_at INTEGER NOT NULL,
  pattern_data TEXT NOT NULL, -- JSON with pattern specifics
  confidence REAL NOT NULL DEFAULT 0.5, -- How confident we are in this pattern
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fp_patterns_rule ON false_positive_patterns(rule_name);
CREATE INDEX IF NOT EXISTS idx_fp_patterns_type ON false_positive_patterns(pattern_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fp_patterns_unique ON false_positive_patterns(rule_name, pattern_type, pattern_data);

-- Improvement Rules table - Auto-generated rules to improve detection
CREATE TABLE IF NOT EXISTS improvement_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL, -- Which detection rule this improves
  condition TEXT NOT NULL, -- 'before_detection', 'during_detection', 'after_detection'
  action TEXT NOT NULL, -- 'add_check', 'reduce_confidence', 'skip_detection', 'change_severity'
  check_type TEXT, -- 'verify_services_enabled', 'verify_interface_list_rules', etc.
  parameters TEXT NOT NULL, -- JSON with rule parameters
  priority INTEGER NOT NULL DEFAULT 1,
  evidence_count INTEGER NOT NULL, -- How many false positives led to this rule
  enabled BOOLEAN NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_applied_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_improvement_rules_name ON improvement_rules(rule_name);
CREATE INDEX IF NOT EXISTS idx_improvement_rules_enabled ON improvement_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_improvement_rules_priority ON improvement_rules(priority DESC);

-- Learning Metrics table - Track accuracy improvements over time
CREATE TABLE IF NOT EXISTS learning_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  total_detections INTEGER NOT NULL,
  true_positives INTEGER NOT NULL,
  false_positives INTEGER NOT NULL,
  needs_investigation INTEGER NOT NULL,
  false_positive_rate REAL NOT NULL,
  accuracy REAL NOT NULL,
  active_improvement_rules INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_metrics_rule ON learning_metrics(rule_name);
CREATE INDEX IF NOT EXISTS idx_learning_metrics_time ON learning_metrics(created_at DESC);

-- Record this migration
INSERT OR IGNORE INTO migrations (version, name, applied_at)
VALUES (1, 'feedback_and_learning_system', strftime('%s', 'now') * 1000);
