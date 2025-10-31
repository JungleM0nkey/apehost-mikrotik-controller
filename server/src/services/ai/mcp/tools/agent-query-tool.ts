/**
 * Agent Query Tool
 *
 * Provides AI access to the Agent monitoring system's issue database.
 * Enables context-aware troubleshooting by querying detected issues,
 * historical patterns, and system health status.
 *
 * This bridges the AI Assistant with the Agent monitoring infrastructure.
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import { getAgentDatabase } from '../../../agent/database/agent-db.js';
import { getFeedbackDatabase } from '../../../agent/database/feedback-db.js';
import type { Issue, Severity, Category } from '../../../agent/models/types.js';

export class AgentQueryTool extends BaseMCPTool {
  readonly name = 'query_agent_system';
  readonly description = `Query the monitoring agent's issue database and detection history. Provides access to:
- Active system issues detected by automated monitoring
- Issue details including severity, category, recommendations
- Historical patterns and detection statistics
- False positive patterns learned from user feedback

Use this tool to understand current system health, past issues, and learned patterns.
This enables context-aware troubleshooting by leveraging automated monitoring data.`;

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get_issues', 'get_issue_details', 'search_patterns', 'get_stats'],
        description: `Action to perform:
- get_issues: Query issues with optional filters
- get_issue_details: Get full details of a specific issue
- search_patterns: Search for patterns in issue history
- get_stats: Get overall system health statistics`,
      },
      // For get_issues
      status: {
        type: 'string',
        enum: ['detected', 'investigating', 'resolved', 'ignored'],
        description: 'Filter issues by status (for get_issues action)',
      },
      severity: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low'],
        description: 'Filter issues by severity level (for get_issues action)',
      },
      category: {
        type: 'string',
        enum: ['security', 'performance', 'stability', 'configuration'],
        description: 'Filter issues by category (for get_issues action)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50, max: 200)',
      },
      since: {
        type: 'number',
        description: 'Return issues detected since this Unix timestamp (for get_issues action)',
      },
      // For get_issue_details
      issue_id: {
        type: 'string',
        description: 'Issue ID to get details for (required for get_issue_details action)',
      },
      // For search_patterns
      rule_name: {
        type: 'string',
        description: 'Detection rule name to search patterns for (for search_patterns action)',
      },
      keyword: {
        type: 'string',
        description: 'Keyword to search in issue titles and descriptions (for search_patterns action)',
      },
      timeframe: {
        type: 'string',
        enum: ['1h', '24h', '7d', '30d', 'all'],
        description: 'Timeframe for pattern search (default: 30d)',
      },
    },
    required: ['action'],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate input
      const validation = this.validateInput(params);
      if (!validation.valid) {
        return this.error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      const action = params.action as string;

      // Route to appropriate handler
      switch (action) {
        case 'get_issues':
          return await this.getIssues(params, startTime);
        case 'get_issue_details':
          return await this.getIssueDetails(params, startTime);
        case 'search_patterns':
          return await this.searchPatterns(params, startTime);
        case 'get_stats':
          return await this.getStats(startTime);
        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to query agent system',
        executionTime
      );
    }
  }

  /**
   * Get issues with optional filters
   */
  private async getIssues(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const agentDb = getAgentDatabase();

    const filters: any = {};

    if (params.status) filters.status = params.status as string;
    if (params.severity) filters.severity = params.severity as string;
    if (params.category) filters.category = params.category as string;
    if (params.limit) filters.limit = Math.min(params.limit as number, 200);
    else filters.limit = 50;

    let issues = agentDb.getIssues(filters);

    // Filter by timestamp if provided
    if (params.since) {
      const sinceTime = params.since as number;
      issues = issues.filter(issue => issue.detected_at >= sinceTime);
    }

    // Format for AI consumption
    const formattedIssues = issues.map(issue => this.formatIssue(issue));

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        count: formattedIssues.length,
        filters: filters,
        issues: formattedIssues,
        summary: this.generateIssueSummary(issues),
      },
      executionTime
    );
  }

  /**
   * Get detailed information about a specific issue
   */
  private async getIssueDetails(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    if (!params.issue_id) {
      return this.error('issue_id parameter is required for get_issue_details action');
    }

    const agentDb = getAgentDatabase();
    const feedbackDb = getFeedbackDatabase();

    const issue = agentDb.getIssue(params.issue_id as string);

    if (!issue) {
      return this.error(`Issue not found: ${params.issue_id}`);
    }

    // Get feedback if available
    const feedback = feedbackDb.getFeedback(issue.id);

    // Get related patterns if available
    const ruleName = issue.metadata?.rule_name as string | undefined;
    let relatedPatterns = null;
    if (ruleName) {
      relatedPatterns = feedbackDb.getPatternsByRule(ruleName);
    }

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        issue: this.formatIssue(issue),
        feedback: feedback || null,
        related_patterns: relatedPatterns?.length ? relatedPatterns : null,
        detection_metadata: issue.metadata || null,
      },
      executionTime
    );
  }

  /**
   * Search for patterns in issue history
   */
  private async searchPatterns(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const agentDb = getAgentDatabase();
    const feedbackDb = getFeedbackDatabase();

    // Calculate timeframe
    const timeframe = (params.timeframe as string) || '30d';
    const sinceTime = this.calculateTimeframeStart(timeframe);

    let issues: Issue[] = [];

    // Filter by rule name if provided
    if (params.rule_name) {
      const allIssues = agentDb.getIssues({});
      issues = allIssues.filter(issue =>
        issue.metadata?.rule_name === params.rule_name &&
        issue.detected_at >= sinceTime
      );
    } else if (params.keyword) {
      // Search by keyword in title/description
      const allIssues = agentDb.getIssues({});
      const keyword = (params.keyword as string).toLowerCase();
      issues = allIssues.filter(issue =>
        (issue.title.toLowerCase().includes(keyword) ||
         issue.description.toLowerCase().includes(keyword)) &&
        issue.detected_at >= sinceTime
      );
    } else {
      // Get all recent issues
      issues = agentDb.getIssues({}).filter(issue => issue.detected_at >= sinceTime);
    }

    // Analyze patterns
    const patterns = this.analyzeIssuePatterns(issues);

    // Get learned false positive patterns
    const learnedPatterns = params.rule_name
      ? feedbackDb.getPatternsByRule(params.rule_name as string)
      : [];

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        timeframe,
        search_criteria: {
          rule_name: params.rule_name || null,
          keyword: params.keyword || null,
        },
        total_issues: issues.length,
        patterns,
        learned_false_positive_patterns: learnedPatterns.length > 0 ? learnedPatterns : null,
      },
      executionTime
    );
  }

  /**
   * Get overall system health statistics
   */
  private async getStats(startTime: number): Promise<ToolResult> {
    const agentDb = getAgentDatabase();

    const allIssues = agentDb.getIssues({});
    const activeIssues = allIssues.filter(i => i.status === 'detected');
    const resolvedIssues = allIssues.filter(i => i.status === 'resolved');

    // Count by severity
    const severityCounts = {
      critical: activeIssues.filter(i => i.severity === 'critical').length,
      high: activeIssues.filter(i => i.severity === 'high').length,
      medium: activeIssues.filter(i => i.severity === 'medium').length,
      low: activeIssues.filter(i => i.severity === 'low').length,
    };

    // Count by category
    const categoryCounts = {
      security: activeIssues.filter(i => i.category === 'security').length,
      performance: activeIssues.filter(i => i.category === 'performance').length,
      stability: activeIssues.filter(i => i.category === 'stability').length,
      configuration: activeIssues.filter(i => i.category === 'configuration').length,
    };

    // Calculate resolution rate
    const totalIssues = allIssues.length;
    const resolutionRate = totalIssues > 0 ? (resolvedIssues.length / totalIssues) * 100 : 0;

    // Recent activity (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentIssues = allIssues.filter(i => i.detected_at >= oneDayAgo);

    const executionTime = Date.now() - startTime;

    return this.success(
      {
        overall_health: this.calculateHealthScore(severityCounts),
        active_issues_count: activeIssues.length,
        resolved_issues_count: resolvedIssues.length,
        resolution_rate_percent: Math.round(resolutionRate * 10) / 10,
        by_severity: severityCounts,
        by_category: categoryCounts,
        recent_activity_24h: {
          new_issues: recentIssues.length,
          critical_issues: recentIssues.filter(i => i.severity === 'critical').length,
        },
        timestamp: new Date().toISOString(),
      },
      executionTime
    );
  }

  /**
   * Format issue for AI consumption
   */
  private formatIssue(issue: Issue): Record<string, unknown> {
    return {
      id: issue.id,
      severity: issue.severity,
      category: issue.category,
      status: issue.status,
      title: issue.title,
      description: issue.description,
      recommendation: issue.recommendation || null,
      confidence: Math.round(issue.confidence_score * 100),
      detected_at: new Date(issue.detected_at).toISOString(),
      resolved_at: issue.resolved_at ? new Date(issue.resolved_at).toISOString() : null,
      detection_rule: issue.metadata?.rule_name || 'unknown',
      time_since_detection: this.formatDuration(Date.now() - issue.detected_at),
    };
  }

  /**
   * Generate summary of issues
   */
  private generateIssueSummary(issues: Issue[]): string {
    if (issues.length === 0) {
      return 'No issues found matching the criteria.';
    }

    const critical = issues.filter(i => i.severity === 'critical').length;
    const high = issues.filter(i => i.severity === 'high').length;
    const medium = issues.filter(i => i.severity === 'medium').length;
    const low = issues.filter(i => i.severity === 'low').length;

    const parts: string[] = [];
    if (critical > 0) parts.push(`${critical} critical`);
    if (high > 0) parts.push(`${high} high`);
    if (medium > 0) parts.push(`${medium} medium`);
    if (low > 0) parts.push(`${low} low`);

    return `Found ${issues.length} issue${issues.length !== 1 ? 's' : ''}: ${parts.join(', ')}`;
  }

  /**
   * Analyze patterns in issues
   */
  private analyzeIssuePatterns(issues: Issue[]): Record<string, unknown> {
    // Group by rule name
    const byRule: Record<string, number> = {};
    issues.forEach(issue => {
      const ruleName = (issue.metadata?.rule_name as string) || 'unknown';
      byRule[ruleName] = (byRule[ruleName] || 0) + 1;
    });

    // Find most common issues
    const ruleFrequency = Object.entries(byRule)
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total_unique_rule_types: Object.keys(byRule).length,
      most_common_issues: ruleFrequency.slice(0, 5),
      average_confidence: Math.round(
        (issues.reduce((sum, i) => sum + i.confidence_score, 0) / issues.length) * 100
      ),
    };
  }

  /**
   * Calculate health score based on active issues
   */
  private calculateHealthScore(severityCounts: Record<string, number>): {
    score: number;
    status: string;
  } {
    let score = 100;

    // Deduct points based on severity
    score -= severityCounts.critical * 25;
    score -= severityCounts.high * 10;
    score -= severityCounts.medium * 5;
    score -= severityCounts.low * 2;

    score = Math.max(0, score);

    let status: string;
    if (score >= 90) status = 'excellent';
    else if (score >= 75) status = 'good';
    else if (score >= 50) status = 'fair';
    else if (score >= 25) status = 'poor';
    else status = 'critical';

    return { score, status };
  }

  /**
   * Calculate start time for timeframe
   */
  private calculateTimeframeStart(timeframe: string): number {
    const now = Date.now();
    switch (timeframe) {
      case '1h':
        return now - 60 * 60 * 1000;
      case '24h':
        return now - 24 * 60 * 60 * 1000;
      case '7d':
        return now - 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return now - 30 * 24 * 60 * 60 * 1000;
      case 'all':
      default:
        return 0;
    }
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}
