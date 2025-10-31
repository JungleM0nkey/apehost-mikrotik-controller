/**
 * Pattern Learning MCP Tool
 * Phase 3.2: Pattern-Aware Responses
 *
 * Provides access to learned patterns and historical resolution data
 * to enable data-driven AI recommendations
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolResult, ToolInputSchema } from '../types.js';
import { getFeedbackDatabase } from '../../../agent/database/feedback-db.js';
import { getAgentDatabase } from '../../../agent/database/agent-db.js';
import type {
  FalsePositivePattern,
  IssueFeedback,
} from '../../../agent/models/feedback-types.js';
import type {
  TroubleshootingSession,
  SessionStep,
  SessionEffectiveness,
} from '../../../agent/models/types.js';

export class PatternLearningTool extends BaseMCPTool {
  readonly name = 'pattern_learning';
  readonly description = `Access learned patterns and historical resolution data for data-driven recommendations.

Actions:
- get_learned_patterns: Retrieve false positive patterns from the learning system
- query_resolution_history: Query historical troubleshooting sessions and their outcomes
- get_resolution_stats: Get success rate statistics for different resolution approaches
- analyze_effectiveness: Analyze resolution effectiveness by approach (Phase 3.3)

Use this tool to:
- Understand which detection patterns are likely false positives
- Learn from historically successful troubleshooting approaches
- Avoid approaches that have failed in the past
- Provide confidence scores based on historical success rates
- Compare effectiveness of different resolution approaches
- Generate data-driven recommendations based on success metrics`;

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get_learned_patterns', 'query_resolution_history', 'get_resolution_stats', 'analyze_effectiveness'],
        description: 'The action to perform',
      },
      // get_learned_patterns parameters
      rule_name: {
        type: 'string',
        description: 'Filter patterns by detection rule name (for get_learned_patterns)',
      },
      confidence_threshold: {
        type: 'number',
        description: 'Minimum confidence score (0.0-1.0) for patterns (default: 0.5)',
      },
      // query_resolution_history parameters
      symptom_keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keywords to search in issue descriptions (for query_resolution_history)',
      },
      timeframe_days: {
        type: 'number',
        description: 'Number of days to look back (default: 30)',
      },
      min_success_rate: {
        type: 'number',
        description: 'Minimum success rate filter (0.0-1.0)',
      },
      resolved_only: {
        type: 'boolean',
        description: 'Only return resolved sessions (default: true)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of sessions to return (default: 20)',
      },
    },
    required: ['action'],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    const action = params.action as string;

    try {
      switch (action) {
        case 'get_learned_patterns':
          return await this.getLearnedPatterns(params, startTime);
        case 'query_resolution_history':
          return await this.queryResolutionHistory(params, startTime);
        case 'get_resolution_stats':
          return await this.getResolutionStats(params, startTime);
        case 'analyze_effectiveness':
          return await this.analyzeEffectiveness(params, startTime);
        default:
          return this.error(`Unknown action: ${action}`, startTime);
      }
    } catch (error: any) {
      console.error('[PatternLearningTool] Error:', error);
      return this.error(error.message || 'Unknown error occurred', Date.now() - startTime);
    }
  }

  private async getLearnedPatterns(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const rule_name = params.rule_name as string | undefined;
    const confidence_threshold = (params.confidence_threshold as number) || 0.5;

    const feedbackDb = getFeedbackDatabase();

    let patterns: FalsePositivePattern[] = [];

    if (rule_name) {
      // Get patterns for specific rule
      patterns = feedbackDb.getPatterns(rule_name);
    } else {
      // Get all patterns from the database
      patterns = feedbackDb.getAllPatterns();
    }

    // Filter by confidence threshold
    patterns = patterns.filter(p => p.confidence >= confidence_threshold);

    // Sort by occurrence count (most common first)
    patterns.sort((a, b) => b.occurrence_count - a.occurrence_count);

    // Generate insights
    const insights = this.generatePatternInsights(patterns);

    return this.success({
      patterns: patterns.map(p => ({
        rule_name: p.rule_name,
        pattern_type: p.pattern_type,
        occurrence_count: p.occurrence_count,
        confidence: p.confidence,
        pattern_data: p.pattern_data,
        last_seen: new Date(p.last_seen_at).toISOString(),
        created: new Date(p.created_at).toISOString(),
      })),
      total_patterns: patterns.length,
      insights,
      recommendation: this.generatePatternRecommendation(patterns),
    }, startTime);
  }

  private async queryResolutionHistory(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const symptom_keywords = (params.symptom_keywords as string[]) || [];
    const timeframe_days = (params.timeframe_days as number) || 30;
    const min_success_rate = params.min_success_rate as number | undefined;
    const resolved_only = params.resolved_only !== false; // default true
    const limit = (params.limit as number) || 20;

    const agentDb = getAgentDatabase();

    // Get sessions with filters
    const since = Date.now() - (timeframe_days * 24 * 60 * 60 * 1000);
    const allSessions = agentDb.getSessions({
      status: resolved_only ? 'resolved' : undefined,
      limit: 100, // Get more to filter
    });

    // Filter by time and keywords
    let sessions = allSessions.filter(s => s.created_at >= since);

    if (symptom_keywords.length > 0) {
      const keywords = symptom_keywords.map(k => k.toLowerCase());
      sessions = sessions.filter(s =>
        keywords.some(kw => s.description.toLowerCase().includes(kw))
      );
    }

    // Limit results
    sessions = sessions.slice(0, limit);

    // Enrich with steps and calculate metrics
    const enrichedSessions = sessions.map(session => {
      const steps = agentDb.getSessionSteps(session.id);
      const success_rate = steps.length > 0
        ? steps.filter(s => s.result === 'success').length / steps.length
        : 0;

      return {
        session,
        steps,
        success_rate,
      };
    });

    // Filter by min success rate if provided
    const filteredSessions = min_success_rate !== undefined
      ? enrichedSessions.filter(s => s.success_rate >= min_success_rate)
      : enrichedSessions;

    // Group by effectiveness
    const byEffectiveness = this.groupByEffectiveness(filteredSessions);

    // Extract resolution approaches
    const approaches = this.extractResolutionApproaches(filteredSessions);

    // Generate insights and recommendations
    const insights = this.generateResolutionInsights(filteredSessions, approaches);
    const recommendation = this.generateResolutionRecommendation(filteredSessions, approaches);

    return this.success({
      sessions: filteredSessions.map(({ session, steps, success_rate }) => ({
        id: session.id,
        description: session.description,
        severity: session.severity,
        status: session.status,
        effectiveness: session.effectiveness,
        resolution_summary: session.resolution_summary,
        resolution_time_minutes: session.resolution_time_minutes,
        step_count: steps.length,
        success_rate,
        created_at: new Date(session.created_at).toISOString(),
        resolved_at: session.resolved_at ? new Date(session.resolved_at).toISOString() : null,
      })),
      total_sessions: filteredSessions.length,
      timeframe_days,
      effectiveness_breakdown: byEffectiveness,
      common_approaches: approaches,
      insights,
      recommendation,
    }, startTime);
  }

  private async getResolutionStats(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const timeframe_days = (params.timeframe_days as number) || 30;

    const agentDb = getAgentDatabase();
    const since = Date.now() - (timeframe_days * 24 * 60 * 60 * 1000);

    // Get all resolved sessions
    const sessions = agentDb.getSessions({ status: 'resolved' })
      .filter(s => s.created_at >= since);

    if (sessions.length === 0) {
      return this.success({
        message: 'No resolved sessions found in the specified timeframe',
        timeframe_days,
      }, startTime);
    }

    // Calculate statistics
    const effectiveness_counts = {
      fully_resolved: sessions.filter(s => s.effectiveness === 'fully_resolved').length,
      partially_resolved: sessions.filter(s => s.effectiveness === 'partially_resolved').length,
      unresolved: sessions.filter(s => s.effectiveness === 'unresolved').length,
    };

    const avg_resolution_time = Math.round(
      sessions
        .filter(s => s.resolution_time_minutes)
        .reduce((sum, s) => sum + (s.resolution_time_minutes || 0), 0) / sessions.length
    );

    // Get steps for all sessions
    const allSteps: SessionStep[] = [];
    for (const session of sessions) {
      allSteps.push(...agentDb.getSessionSteps(session.id));
    }

    const step_stats = {
      total_steps: allSteps.length,
      avg_steps_per_session: Math.round(allSteps.length / sessions.length),
      success_count: allSteps.filter(s => s.result === 'success').length,
      failed_count: allSteps.filter(s => s.result === 'failed').length,
      partial_count: allSteps.filter(s => s.result === 'partial').length,
    };

    const overall_success_rate = step_stats.total_steps > 0
      ? step_stats.success_count / step_stats.total_steps
      : 0;

    // Group by severity
    const by_severity = {
      low: sessions.filter(s => s.severity === 'low').length,
      medium: sessions.filter(s => s.severity === 'medium').length,
      high: sessions.filter(s => s.severity === 'high').length,
    };

    return this.success({
      timeframe_days,
      total_sessions: sessions.length,
      effectiveness: effectiveness_counts,
      avg_resolution_time_minutes: avg_resolution_time,
      step_statistics: step_stats,
      overall_success_rate: Math.round(overall_success_rate * 100) / 100,
      severity_distribution: by_severity,
      insights: this.generateStatsInsights(sessions, effectiveness_counts, step_stats),
    }, startTime);
  }

  // ========== Helper Methods ==========

  private generatePatternInsights(patterns: FalsePositivePattern[]): string[] {
    const insights: string[] = [];

    if (patterns.length === 0) {
      insights.push('No learned patterns found. This indicates the learning system is just starting or detection rules are highly accurate.');
      return insights;
    }

    // High confidence patterns
    const highConfidence = patterns.filter(p => p.confidence >= 0.8);
    if (highConfidence.length > 0) {
      insights.push(`${highConfidence.length} high-confidence pattern(s) identified (confidence >= 0.8). These are likely false positives.`);
    }

    // Most common pattern
    const mostCommon = patterns[0]; // Already sorted by occurrence
    if (mostCommon && mostCommon.occurrence_count > 5) {
      insights.push(`Most common pattern: "${mostCommon.rule_name}" (${mostCommon.pattern_type}) - seen ${mostCommon.occurrence_count} times.`);
    }

    // Recent patterns
    const recentThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    const recentPatterns = patterns.filter(p => p.last_seen_at >= recentThreshold);
    if (recentPatterns.length > 0) {
      insights.push(`${recentPatterns.length} pattern(s) seen in the last 7 days, indicating active false positive detection.`);
    }

    return insights;
  }

  private generatePatternRecommendation(patterns: FalsePositivePattern[]): string {
    if (patterns.length === 0) {
      return 'No pattern adjustments needed at this time. Continue monitoring detection accuracy.';
    }

    const highConfidence = patterns.filter(p => p.confidence >= 0.8);
    if (highConfidence.length > 0) {
      const topPattern = highConfidence[0];
      return `Consider refining the "${topPattern.rule_name}" detection rule to reduce false positives. Pattern "${topPattern.pattern_type}" has appeared ${topPattern.occurrence_count} times with ${Math.round(topPattern.confidence * 100)}% confidence.`;
    }

    return `Monitor the identified patterns for recurring false positives. ${patterns.length} pattern(s) detected with moderate confidence.`;
  }

  private groupByEffectiveness(sessions: Array<{ session: TroubleshootingSession; steps: SessionStep[]; success_rate: number }>) {
    return {
      fully_resolved: sessions.filter(s => s.session.effectiveness === 'fully_resolved').length,
      partially_resolved: sessions.filter(s => s.session.effectiveness === 'partially_resolved').length,
      unresolved: sessions.filter(s => s.session.effectiveness === 'unresolved').length,
    };
  }

  private extractResolutionApproaches(
    sessions: Array<{ session: TroubleshootingSession; steps: SessionStep[]; success_rate: number }>
  ): Array<{ approach: string; count: number; success_rate: number }> {
    const approaches = new Map<string, { count: number; successes: number }>();

    for (const { session, steps } of sessions) {
      if (!session.resolution_summary || session.effectiveness === 'unresolved') continue;

      // Extract key actions from resolution summary (simple keyword extraction)
      const summary = session.resolution_summary.toLowerCase();
      const keywords = ['restart', 'reset', 'clear', 'update', 'configure', 'check', 'analyze', 'fix'];

      for (const keyword of keywords) {
        if (summary.includes(keyword)) {
          const existing = approaches.get(keyword) || { count: 0, successes: 0 };
          existing.count++;
          if (session.effectiveness === 'fully_resolved') {
            existing.successes++;
          }
          approaches.set(keyword, existing);
        }
      }
    }

    return Array.from(approaches.entries())
      .map(([approach, stats]) => ({
        approach,
        count: stats.count,
        success_rate: stats.count > 0 ? stats.successes / stats.count : 0,
      }))
      .filter(a => a.count >= 2) // Only show approaches used at least twice
      .sort((a, b) => b.success_rate - a.success_rate || b.count - a.count);
  }

  private generateResolutionInsights(
    sessions: Array<{ session: TroubleshootingSession; steps: SessionStep[]; success_rate: number }>,
    approaches: Array<{ approach: string; count: number; success_rate: number }>
  ): string[] {
    const insights: string[] = [];

    if (sessions.length === 0) {
      insights.push('No historical resolution data found for the specified criteria.');
      return insights;
    }

    // Overall effectiveness
    const fullyResolved = sessions.filter(s => s.session.effectiveness === 'fully_resolved').length;
    const resolutionRate = Math.round((fullyResolved / sessions.length) * 100);
    insights.push(`${resolutionRate}% of similar issues were fully resolved (${fullyResolved}/${sessions.length} sessions).`);

    // Average time
    const avgTime = Math.round(
      sessions
        .filter(s => s.session.resolution_time_minutes)
        .reduce((sum, s) => sum + (s.session.resolution_time_minutes || 0), 0) / sessions.length
    );
    if (avgTime > 0) {
      insights.push(`Average resolution time: ${avgTime} minutes.`);
    }

    // Best approach
    if (approaches.length > 0) {
      const best = approaches[0];
      insights.push(`Most successful approach: "${best.approach}" with ${Math.round(best.success_rate * 100)}% success rate (used ${best.count} times).`);
    }

    // Common pitfalls
    const unsuccessfulSteps = sessions
      .flatMap(s => s.steps)
      .filter(step => step.result === 'failed');
    if (unsuccessfulSteps.length > 5) {
      insights.push(`${unsuccessfulSteps.length} failed steps recorded across sessions. Review these to avoid common pitfalls.`);
    }

    return insights;
  }

  private generateResolutionRecommendation(
    sessions: Array<{ session: TroubleshootingSession; steps: SessionStep[]; success_rate: number }>,
    approaches: Array<{ approach: string; count: number; success_rate: number }>
  ): string {
    if (sessions.length === 0) {
      return 'No historical data available. Proceed with standard troubleshooting methodology.';
    }

    if (approaches.length === 0) {
      return 'Based on historical sessions, investigate systematically and document resolution approaches for future reference.';
    }

    const best = approaches[0];
    const worst = approaches[approaches.length - 1];

    let recommendation = `Based on ${sessions.length} similar session(s):\n\n`;
    recommendation += `RECOMMENDED: Try "${best.approach}" first (${Math.round(best.success_rate * 100)}% success rate, ${best.count} historical uses).\n\n`;

    if (worst && worst.success_rate < 0.3) {
      recommendation += `AVOID: "${worst.approach}" has low success rate (${Math.round(worst.success_rate * 100)}%) for this type of issue.\n\n`;
    }

    const fullyResolved = sessions.filter(s => s.session.effectiveness === 'fully_resolved');
    if (fullyResolved.length > 0) {
      const avgSteps = Math.round(
        fullyResolved.reduce((sum, s) => sum + s.steps.length, 0) / fullyResolved.length
      );
      recommendation += `Fully resolved sessions typically required ${avgSteps} steps. Plan accordingly.`;
    }

    return recommendation;
  }

  private generateStatsInsights(
    sessions: TroubleshootingSession[],
    effectiveness: Record<string, number>,
    step_stats: any
  ): string[] {
    const insights: string[] = [];

    const total = sessions.length;
    const fullyResolved = effectiveness.fully_resolved;
    const resolutionRate = Math.round((fullyResolved / total) * 100);

    if (resolutionRate >= 80) {
      insights.push(`High resolution success rate (${resolutionRate}%). Troubleshooting approaches are working well.`);
    } else if (resolutionRate < 50) {
      insights.push(`Low resolution rate (${resolutionRate}%). Consider reviewing troubleshooting strategies or escalation criteria.`);
    }

    const avgSteps = step_stats.avg_steps_per_session;
    if (avgSteps > 10) {
      insights.push(`High average step count (${avgSteps} steps). Look for opportunities to streamline troubleshooting workflows.`);
    } else if (avgSteps < 3) {
      insights.push(`Low step count (${avgSteps} steps). Issues may be straightforward or under-documented.`);
    }

    const stepSuccessRate = step_stats.success_count / step_stats.total_steps;
    if (stepSuccessRate >= 0.8) {
      insights.push(`High step success rate (${Math.round(stepSuccessRate * 100)}%). Troubleshooting actions are generally effective.`);
    } else if (stepSuccessRate < 0.5) {
      insights.push(`Low step success rate (${Math.round(stepSuccessRate * 100)}%). Many attempted solutions are not working - review approach selection.`);
    }

    return insights;
  }

  /**
   * Analyze resolution effectiveness by approach
   * Phase 3.3: Resolution Effectiveness Tracking
   */
  private async analyzeEffectiveness(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const timeframe_days = (params.timeframe_days as number) || 30;

    const agentDb = getAgentDatabase();

    // Get effectiveness analysis by approach
    const approachAnalysis = agentDb.getEffectivenessAnalysis(timeframe_days);

    // Get overall effectiveness statistics
    const overallStats = agentDb.getOverallEffectiveness(timeframe_days);

    // Generate insights
    const insights = this.generateEffectivenessInsights(approachAnalysis, overallStats);

    // Generate recommendation
    const recommendation = this.generateEffectivenessRecommendation(approachAnalysis, overallStats);

    return this.success({
      timeframe_days,
      overall_statistics: {
        total_sessions: overallStats.total_sessions,
        resolved_sessions: overallStats.resolved_sessions,
        active_sessions: overallStats.active_sessions,
        effectiveness_breakdown: overallStats.effectiveness_breakdown,
        overall_success_rate: Math.round(overallStats.overall_success_rate * 100) / 100,
        avg_resolution_time_minutes: overallStats.avg_resolution_time_minutes,
        avg_steps_per_session: overallStats.avg_steps_per_session,
      },
      approaches: approachAnalysis.map(a => ({
        approach: a.approach,
        total_attempts: a.total_attempts,
        success_rate: Math.round(a.success_rate * 100) / 100,
        effectiveness: {
          fully_resolved: a.fully_resolved,
          partially_resolved: a.partially_resolved,
          unresolved: a.unresolved,
        },
        performance: {
          avg_resolution_time_minutes: a.avg_resolution_time_minutes,
          avg_steps: a.avg_steps,
        },
      })),
      insights,
      recommendation,
    }, startTime);
  }

  private generateEffectivenessInsights(
    approaches: Array<any>,
    overall: any
  ): string[] {
    const insights: string[] = [];

    // Overall effectiveness insight
    const successRate = Math.round(overall.overall_success_rate * 100);
    if (successRate >= 75) {
      insights.push(`Strong overall success rate (${successRate}%). Troubleshooting system is performing well.`);
    } else if (successRate < 50) {
      insights.push(`Low overall success rate (${successRate}%). Significant opportunity for improvement.`);
    } else {
      insights.push(`Moderate success rate (${successRate}%). Room for optimization in troubleshooting approaches.`);
    }

    // Top performing approaches
    if (approaches.length > 0) {
      const topApproach = approaches[0];
      const topSuccessRate = Math.round(topApproach.success_rate * 100);
      insights.push(`Most effective approach: "${topApproach.approach}" with ${topSuccessRate}% success rate (${topApproach.total_attempts} uses).`);
    }

    // Identify struggling approaches
    const lowPerformers = approaches.filter(a => a.success_rate < 0.5 && a.total_attempts >= 3);
    if (lowPerformers.length > 0) {
      insights.push(`${lowPerformers.length} approach(es) with <50% success rate may need review: ${lowPerformers.map(a => a.approach).join(', ')}`);
    }

    // Resolution time insight
    if (overall.avg_resolution_time_minutes > 60) {
      insights.push(`Average resolution time is ${overall.avg_resolution_time_minutes} minutes. Consider streamlining workflows.`);
    } else if (overall.avg_resolution_time_minutes < 15) {
      insights.push(`Quick average resolution time (${overall.avg_resolution_time_minutes} minutes) suggests efficient troubleshooting.`);
    }

    // Step efficiency insight
    if (overall.avg_steps_per_session > 8) {
      insights.push(`High average step count (${overall.avg_steps_per_session} steps). Look for opportunities to consolidate steps.`);
    }

    return insights;
  }

  private generateEffectivenessRecommendation(
    approaches: Array<any>,
    overall: any
  ): string {
    let recommendation = '';

    if (approaches.length === 0) {
      return 'Insufficient data for recommendations. Continue troubleshooting and track resolutions to build effectiveness metrics.';
    }

    // Recommend top performing approaches
    const topApproaches = approaches.filter(a => a.success_rate >= 0.7).slice(0, 3);
    if (topApproaches.length > 0) {
      recommendation += `Prioritize these high-success approaches: ${topApproaches.map(a => `"${a.approach}" (${Math.round(a.success_rate * 100)}%)`).join(', ')}. `;
    }

    // Warn about low performers
    const lowPerformers = approaches.filter(a => a.success_rate < 0.4 && a.total_attempts >= 3);
    if (lowPerformers.length > 0) {
      recommendation += `Consider alternative approaches for: ${lowPerformers.map(a => a.approach).join(', ')} (low success rates). `;
    }

    // Time-based recommendation
    const fastApproaches = approaches.filter(a => a.avg_resolution_time_minutes < 20 && a.success_rate >= 0.6);
    if (fastApproaches.length > 0) {
      recommendation += `For quick resolution, try: ${fastApproaches[0].approach} (avg ${fastApproaches[0].avg_resolution_time_minutes} min, ${Math.round(fastApproaches[0].success_rate * 100)}% success). `;
    }

    if (!recommendation) {
      recommendation = 'Continue current approaches and track outcomes to identify patterns.';
    }

    return recommendation;
  }
}
