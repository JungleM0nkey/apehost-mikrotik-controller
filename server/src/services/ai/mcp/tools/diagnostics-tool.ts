/**
 * Diagnostics Tool
 *
 * Allows the AI assistant to run diagnostic scans to identify issues
 * in the MikroTik router configuration and system health.
 *
 * This tool provides:
 * - On-demand diagnostic scans
 * - Category-specific checks (security, performance, stability, configuration)
 * - Deep scan mode for comprehensive analysis
 * - Issue history and trends
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import { getIssueDetector } from '../../../agent/detector/issue-detector.js';
import { getAgentDatabase } from '../../../agent/database/agent-db.js';
import { getRuleCounts } from '../../../agent/rules/index.js';

export class DiagnosticsTool extends BaseMCPTool {
  readonly name = 'run_diagnostics';
  readonly description =
    'Run diagnostic scans on the MikroTik router to identify configuration issues, security vulnerabilities, misconfigurations, and stability concerns. Use this when the user asks about router health, configuration problems, security issues, or system problems. DO NOT use for network speed tests or bandwidth measurements.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      categories: {
        type: 'array',
        description: 'Limit scan to specific categories (security, performance, stability, configuration). If omitted, scans all categories.',
        items: {
          type: 'string',
          enum: ['security', 'performance', 'stability', 'configuration'],
        },
      },
      deep_scan: {
        type: 'boolean',
        description: 'Perform deep scan with detailed analysis. Default: false',
      },
      include_history: {
        type: 'boolean',
        description: 'Include historical issues and trends. Default: false',
      },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const validation = this.validateInput(params);
      if (!validation.valid) {
        return this.error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      const categories = params.categories as string[] | undefined;
      const deepScan = params.deep_scan as boolean | undefined;
      const includeHistory = params.include_history as boolean | undefined;

      const detector = getIssueDetector();
      const db = getAgentDatabase();

      let detectedIssues;
      let newIssues = [];

      if (deepScan) {
        // Deep scan - stores new issues in database
        const scanResult = await detector.performDeepScan();
        detectedIssues = scanResult.allActiveIssues;
        newIssues = scanResult.newIssues;
      } else {
        // Quick scan - just detect without storing
        const categoryFilter = categories?.length ? (categories as ('security' | 'performance' | 'stability' | 'configuration')[]) : undefined;
        detectedIssues = await detector.detectIssues(categoryFilter);
      }

      // Group issues by severity and category
      const bySeverity = {
        critical: detectedIssues.filter(i => i.severity === 'critical'),
        high: detectedIssues.filter(i => i.severity === 'high'),
        medium: detectedIssues.filter(i => i.severity === 'medium'),
        low: detectedIssues.filter(i => i.severity === 'low'),
      };

      const byCategory = {
        security: detectedIssues.filter(i => i.category === 'security'),
        performance: detectedIssues.filter(i => i.category === 'performance'),
        stability: detectedIssues.filter(i => i.category === 'stability'),
        configuration: detectedIssues.filter(i => i.category === 'configuration'),
      };

      // Build response
      const result: any = {
        scan_type: deepScan ? 'deep' : 'quick',
        timestamp: new Date().toISOString(),
        total_issues_found: detectedIssues.length,
        new_issues: newIssues.length,
        by_severity: {
          critical: bySeverity.critical.length,
          high: bySeverity.high.length,
          medium: bySeverity.medium.length,
          low: bySeverity.low.length,
        },
        by_category: {
          security: byCategory.security.length,
          performance: byCategory.performance.length,
          stability: byCategory.stability.length,
          configuration: byCategory.configuration.length,
        },
        issues: detectedIssues.map(issue => ({
          id: issue.id,
          severity: issue.severity,
          category: issue.category,
          title: issue.title,
          description: issue.description,
          recommendation: issue.recommendation,
          confidence_score: issue.confidence_score,
          status: issue.status,
        })),
        rules_info: getRuleCounts(),
      };

      // Include history if requested
      if (includeHistory) {
        const historicalIssues = db.getIssues({ limit: 50 });
        const resolvedIssues = historicalIssues.filter(i => i.status === 'resolved');

        result.history = {
          total_historical_issues: historicalIssues.length,
          resolved_issues: resolvedIssues.length,
          resolution_rate: historicalIssues.length > 0
            ? ((resolvedIssues.length / historicalIssues.length) * 100).toFixed(1) + '%'
            : 'N/A',
        };
      }

      const executionTime = Date.now() - startTime;

      return this.success(result, executionTime);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to run diagnostics',
        executionTime
      );
    }
  }
}
