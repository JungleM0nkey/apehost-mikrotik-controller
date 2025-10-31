/**
 * Agent Type Definitions
 * Core types for the autonomous agent system
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Category = 'security' | 'performance' | 'stability' | 'configuration';
export type IssueStatus = 'detected' | 'investigating' | 'resolved' | 'ignored';

/**
 * Issue detected by the agent
 */
export interface Issue {
  id: string;
  detected_at: number; // Unix timestamp
  resolved_at?: number;
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  recommendation?: string;
  status: IssueStatus;
  confidence_score: number; // 0.0 - 1.0
  metadata?: Record<string, unknown>;
}

/**
 * Metrics snapshot for baseline tracking
 */
export interface MetricsSnapshot {
  id?: number;
  collected_at: number;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  uptime?: number;
  connection_count?: number;
  interface_stats?: Record<string, InterfaceMetrics>;
}

export interface InterfaceMetrics {
  name: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_errors: number;
  tx_errors: number;
  rx_rate: number;
  tx_rate: number;
}

/**
 * Detection rule result
 */
export interface DetectionResult {
  rule_name: string;
  issue?: Issue;
  execution_time_ms: number;
}

/**
 * Router state snapshot for detection
 */
export interface RouterState {
  router_info?: any;
  interfaces?: any[];
  dhcp_leases?: any[];
  routes?: any[];
  firewall_rules?: any[];
  traffic_stats?: any;
  wireless_info?: any;
  system_resources?: any;
  logs?: any[];
  timestamp: number;
}

/**
 * Detection rule interface
 */
export interface IDetectionRule {
  name: string;
  category: Category;
  severity: Severity;
  description: string;
  detect(state: RouterState): Promise<Issue | null>;
}

/**
 * Phase 2: Proactive Intelligence - Troubleshooting Session Types
 */

export type SessionSeverity = 'low' | 'medium' | 'high';
export type SessionStatus = 'active' | 'resolved' | 'escalated';
export type SessionEffectiveness = 'fully_resolved' | 'partially_resolved' | 'unresolved';
export type StepActionType = 'tool_call' | 'command' | 'analysis' | 'recommendation';
export type StepResult = 'success' | 'failed' | 'partial' | 'pending';

/**
 * Troubleshooting session for tracking multi-step problem resolution
 */
export interface TroubleshootingSession {
  id: string;
  conversation_id: string;
  issue_id?: string;
  description: string;
  severity: SessionSeverity;
  status: SessionStatus;
  created_at: number;
  updated_at: number;
  resolved_at?: number;
  resolution_summary?: string;
  effectiveness?: SessionEffectiveness;
  resolution_time_minutes?: number;
}

/**
 * Individual step in a troubleshooting session
 */
export interface SessionStep {
  id: string;
  session_id: string;
  step_number: number;
  description: string;
  action_type: StepActionType;
  action_data?: Record<string, unknown>;
  result: StepResult;
  timestamp: number;
  notes?: string;
}

/**
 * Phase 3: Advanced Intelligence - Trend Analysis Types
 */

/**
 * Metric data point for trend analysis
 */
export interface MetricDataPoint {
  id: string;
  metric_name: string;
  metric_value: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Trend analysis result with prediction
 */
export interface TrendAnalysis {
  metric_name: string;
  data_points: number;
  time_range: {
    start: number;
    end: number;
    duration_hours: number;
  };
  statistics: {
    min: number;
    max: number;
    avg: number;
    current: number;
  };
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    confidence: number;
  };
  prediction?: {
    next_hour: number;
    next_day: number;
    confidence: number;
  };
  anomalies: Array<{
    timestamp: number;
    value: number;
    z_score: number;
  }>;
}
