/**
 * Types for AI Agent and Diagnostics system
 */

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueCategory = 'security' | 'performance' | 'stability' | 'configuration';
export type IssueStatus = 'detected' | 'investigating' | 'resolved' | 'ignored';

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  confidence_score: number;
  recommendation?: string;
  detected_at: number;
  resolved_at?: number | null;
}

export interface AgentMetrics {
  total_issues: number;
  by_severity: Record<IssueSeverity, number>;
  by_category: Record<IssueCategory, number>;
  by_status: Record<IssueStatus, number>;
  last_scan_time: number;
}

export interface ScanResult {
  scan_type: 'quick' | 'deep';
  total_issues_found: number;
  new_issues: number;
  by_severity: Record<IssueSeverity, number>;
  by_category: Record<IssueCategory, number>;
  issues: Issue[];
  timestamp: number;
}
