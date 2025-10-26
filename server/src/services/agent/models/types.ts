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
