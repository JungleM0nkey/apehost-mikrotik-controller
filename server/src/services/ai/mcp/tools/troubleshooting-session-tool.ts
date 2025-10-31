/**
 * Troubleshooting Session MCP Tool
 * Phase 2: Proactive Intelligence
 *
 * Provides tools for creating and managing multi-step troubleshooting workflows
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolResult, ToolInputSchema } from '../types.js';
import { getAgentDatabase } from '../../../agent/database/agent-db.js';
import type {
  TroubleshootingSession,
  SessionStep,
  SessionSeverity,
  SessionStatus,
  SessionEffectiveness,
  StepActionType,
  StepResult,
} from '../../../agent/models/types.js';

export class TroubleshootingSessionTool extends BaseMCPTool {
  readonly name = 'manage_troubleshooting_session';
  readonly description = `Manage troubleshooting sessions for tracking multi-step problem resolution workflows.

Actions:
- create_session: Create a new troubleshooting session linked to a conversation
- add_step: Add a step to an active session (tool call, command, analysis, recommendation)
- get_history: Retrieve past sessions with steps and outcomes
- resolve_session: Mark a session as resolved with summary and effectiveness rating

Use this tool to:
- Track systematic troubleshooting approaches across multiple steps
- Learn from historical resolution patterns
- Compare resolution effectiveness over time
- Maintain context across multiple troubleshooting attempts`;

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create_session', 'add_step', 'get_history', 'resolve_session'],
        description: 'The action to perform',
      },
      // create_session parameters
      conversation_id: {
        type: 'string',
        description: 'Conversation ID to link session to (required for create_session)',
      },
      issue_id: {
        type: 'string',
        description: 'Optional issue ID to link session to (for create_session)',
      },
      description: {
        type: 'string',
        description: 'Description of the problem being troubleshooted (for create_session)',
      },
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Severity level of the issue (for create_session)',
      },
      // add_step parameters
      session_id: {
        type: 'string',
        description: 'Session ID (required for add_step, resolve_session)',
      },
      step_description: {
        type: 'string',
        description: 'Description of the troubleshooting step taken (for add_step)',
      },
      action_type: {
        type: 'string',
        enum: ['tool_call', 'command', 'analysis', 'recommendation'],
        description: 'Type of action taken in this step (for add_step)',
      },
      action_data: {
        type: 'object',
        description: 'Data associated with the action (tool parameters, command, etc.) (for add_step)',
      },
      result: {
        type: 'string',
        enum: ['success', 'failed', 'partial', 'pending'],
        description: 'Result of the step (for add_step)',
      },
      notes: {
        type: 'string',
        description: 'Additional notes about the step (for add_step)',
      },
      // resolve_session parameters
      resolution_summary: {
        type: 'string',
        description: 'Summary of how the issue was resolved (for resolve_session)',
      },
      effectiveness: {
        type: 'string',
        enum: ['fully_resolved', 'partially_resolved', 'unresolved'],
        description: 'How effective the resolution was (for resolve_session)',
      },
      // get_history parameters
      status: {
        type: 'string',
        enum: ['active', 'resolved', 'escalated'],
        description: 'Filter by session status (for get_history)',
      },
      issue_type: {
        type: 'string',
        description: 'Filter by issue description keywords (for get_history)',
      },
      resolved_only: {
        type: 'boolean',
        description: 'Only return resolved sessions (for get_history)',
      },
      since: {
        type: 'number',
        description: 'Only return sessions since this timestamp (for get_history)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of sessions to return (for get_history)',
      },
    },
    required: ['action'],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    const action = params.action as string;

    try {
      switch (action) {
        case 'create_session':
          return await this.createSession(params, startTime);
        case 'add_step':
          return await this.addStep(params, startTime);
        case 'get_history':
          return await this.getHistory(params, startTime);
        case 'resolve_session':
          return await this.resolveSession(params, startTime);
        default:
          return this.error(`Unknown action: ${action}`, startTime);
      }
    } catch (error: any) {
      console.error('[TroubleshootingSessionTool] Error:', error);
      return this.error(error.message || 'Unknown error occurred', Date.now() - startTime);
    }
  }

  private async createSession(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const conversation_id = params.conversation_id as string;
    const description = params.description as string;
    const severity = params.severity as SessionSeverity;
    const issue_id = params.issue_id as string | undefined;

    if (!conversation_id || !description || !severity) {
      return this.error(
        'Missing required parameters. Need: conversation_id, description, severity',
        startTime
      );
    }

    const agentDb = getAgentDatabase();

    const session = agentDb.createSession({
      conversation_id,
      issue_id,
      description,
      severity,
      status: 'active' as SessionStatus,
    });

    return this.success({
      session,
      message: `Created troubleshooting session: ${session.id}`,
      next_steps: [
        `Use add_step to track actions taken: manage_troubleshooting_session({ action: "add_step", session_id: "${session.id}", ... })`,
        `Resolve when done: manage_troubleshooting_session({ action: "resolve_session", session_id: "${session.id}", ... })`,
      ],
    }, startTime);
  }

  private async addStep(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const session_id = params.session_id as string;
    const step_description = params.step_description as string;
    const action_type = params.action_type as StepActionType;
    const action_data = params.action_data as Record<string, unknown> | undefined;
    const result = params.result as StepResult;
    const notes = params.notes as string | undefined;

    if (!session_id || !step_description || !action_type || !result) {
      return this.error(
        'Missing required parameters. Need: session_id, step_description, action_type, result',
        startTime
      );
    }

    const agentDb = getAgentDatabase();

    // Check if session exists
    const session = agentDb.getSession(session_id);
    if (!session) {
      return this.error(`Session not found: ${session_id}`, startTime);
    }

    if (session.status !== 'active') {
      return this.error(
        `Cannot add steps to ${session.status} session. Session must be active.`,
        startTime
      );
    }

    // Get next step number
    const step_number = agentDb.getNextStepNumber(session_id);

    const step = agentDb.addSessionStep({
      session_id,
      step_number,
      description: step_description,
      action_type,
      action_data,
      result,
      notes,
    });

    // Get all steps to show progress
    const all_steps = agentDb.getSessionSteps(session_id);

    return this.success({
      step,
      session_progress: {
        session_id,
        total_steps: all_steps.length,
        successful_steps: all_steps.filter(s => s.result === 'success').length,
        failed_steps: all_steps.filter(s => s.result === 'failed').length,
      },
      message: `Added step ${step_number} to session`,
    }, startTime);
  }

  private async getHistory(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const status = params.status as SessionStatus | undefined;
    const issue_type = params.issue_type as string | undefined;
    const resolved_only = params.resolved_only as boolean | undefined;
    const since = params.since as number | undefined;
    const limit = params.limit as number | undefined;

    const agentDb = getAgentDatabase();

    // Build filters
    const filters: any = {};
    if (status) filters.status = status;
    if (resolved_only) filters.status = 'resolved';
    if (limit) filters.limit = limit;

    let sessions = agentDb.getSessions(filters);

    // Filter by timestamp if provided
    if (since) {
      sessions = sessions.filter(s => s.created_at >= since);
    }

    // Filter by issue type keywords if provided
    if (issue_type) {
      const keywords = issue_type.toLowerCase().split(' ');
      sessions = sessions.filter(s =>
        keywords.some(kw => s.description.toLowerCase().includes(kw))
      );
    }

    // Get steps for each session
    const sessionsWithSteps = sessions.map(session => {
      const steps = agentDb.getSessionSteps(session.id);
      return {
        ...session,
        steps,
        step_count: steps.length,
        success_rate: steps.length > 0
          ? steps.filter(s => s.result === 'success').length / steps.length
          : 0,
      };
    });

    // Calculate success statistics
    const resolvedSessions = sessionsWithSteps.filter(s => s.status === 'resolved');
    const successStats = {
      total_sessions: sessionsWithSteps.length,
      resolved_count: resolvedSessions.length,
      fully_resolved_count: resolvedSessions.filter(s => s.effectiveness === 'fully_resolved').length,
      partially_resolved_count: resolvedSessions.filter(s => s.effectiveness === 'partially_resolved').length,
      unresolved_count: resolvedSessions.filter(s => s.effectiveness === 'unresolved').length,
      avg_resolution_time: resolvedSessions.length > 0
        ? Math.round(resolvedSessions.reduce((sum, s) => sum + (s.resolution_time_minutes || 0), 0) / resolvedSessions.length)
        : 0,
      avg_steps: sessionsWithSteps.length > 0
        ? Math.round(sessionsWithSteps.reduce((sum, s) => sum + s.step_count, 0) / sessionsWithSteps.length)
        : 0,
    };

    return this.success({
      sessions: sessionsWithSteps,
      statistics: successStats,
      insights: this.generateInsights(sessionsWithSteps, successStats),
    }, startTime);
  }

  private async resolveSession(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const session_id = params.session_id as string;
    const resolution_summary = params.resolution_summary as string;
    const effectiveness = params.effectiveness as SessionEffectiveness;

    if (!session_id || !resolution_summary || !effectiveness) {
      return this.error(
        'Missing required parameters. Need: session_id, resolution_summary, effectiveness',
        startTime
      );
    }

    const agentDb = getAgentDatabase();

    // Check if session exists
    const session = agentDb.getSession(session_id);
    if (!session) {
      return this.error(`Session not found: ${session_id}`, startTime);
    }

    if (session.status !== 'active') {
      return this.error(
        `Session is already ${session.status}. Cannot resolve again.`,
        startTime
      );
    }

    agentDb.resolveSession(session_id, resolution_summary, effectiveness);

    const updatedSession = agentDb.getSession(session_id)!;
    const steps = agentDb.getSessionSteps(session_id);

    return this.success({
      session: updatedSession,
      metrics: {
        total_steps: steps.length,
        resolution_time_minutes: updatedSession.resolution_time_minutes,
        effectiveness,
        success_rate: steps.length > 0
          ? steps.filter(s => s.result === 'success').length / steps.length
          : 0,
      },
      message: `Session resolved: ${effectiveness}`,
    }, startTime);
  }

  private generateInsights(sessions: any[], stats: any): string[] {
    const insights: string[] = [];

    if (stats.total_sessions === 0) {
      insights.push('No historical sessions found. This is the first troubleshooting attempt.');
      return insights;
    }

    // Resolution rate insight
    const resolutionRate = stats.resolved_count / stats.total_sessions;
    if (resolutionRate >= 0.8) {
      insights.push(`High resolution success rate (${Math.round(resolutionRate * 100)}%). Historical approaches are working well.`);
    } else if (resolutionRate < 0.5) {
      insights.push(`Low resolution rate (${Math.round(resolutionRate * 100)}%). Consider alternative troubleshooting approaches.`);
    }

    // Effectiveness insight
    if (stats.fully_resolved_count > 0) {
      const fullyResolvedRate = stats.fully_resolved_count / stats.resolved_count;
      insights.push(`${Math.round(fullyResolvedRate * 100)}% of resolved sessions were fully effective.`);
    }

    // Time insight
    if (stats.avg_resolution_time > 0) {
      insights.push(`Average resolution time: ${stats.avg_resolution_time} minutes (${stats.avg_steps} steps on average).`);
    }

    // Common patterns
    const resolvedSessions = sessions.filter(s => s.status === 'resolved' && s.effectiveness === 'fully_resolved');
    if (resolvedSessions.length > 0) {
      insights.push(`${resolvedSessions.length} similar issue(s) fully resolved in the past. Review their steps for proven approaches.`);
    }

    return insights;
  }
}
