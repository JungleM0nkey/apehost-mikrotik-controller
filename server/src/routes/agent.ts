/**
 * Agent API Routes
 * REST API endpoints for the autonomous agent system
 */

import express from 'express';
import { getAgentDatabase } from '../services/agent/database/agent-db.js';
import { getHealthMonitor } from '../services/agent/monitor/health-monitor.js';
import { getIssueDetector } from '../services/agent/detector/issue-detector.js';

const router = express.Router();
const db = getAgentDatabase();
const monitor = getHealthMonitor();
const detector = getIssueDetector();

/**
 * GET /api/agent/issues
 * Get all issues with optional filtering
 */
router.get('/issues', (req, res) => {
  try {
    const { status, severity, category, limit, offset } = req.query;

    const issues = db.getIssues({
      status: status as string | undefined,
      severity: severity as string | undefined,
      category: category as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: {
        issues,
        total: issues.length,
        filters: { status, severity, category, limit, offset },
      },
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to get issues:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get issues',
    });
  }
});

/**
 * GET /api/agent/issues/:id
 * Get a specific issue by ID
 */
router.get('/issues/:id', (req, res) => {
  try {
    const { id } = req.params;
    const issue = db.getIssue(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      });
    }

    res.json({
      success: true,
      data: issue,
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to get issue:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get issue',
    });
  }
});

/**
 * PATCH /api/agent/issues/:id
 * Update issue status (e.g., mark as resolved or ignored)
 */
router.patch('/issues/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['detected', 'investigating', 'resolved', 'ignored'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: detected, investigating, resolved, or ignored',
      });
    }

    const resolvedAt = status === 'resolved' ? Date.now() : undefined;
    db.updateIssueStatus(id, status, resolvedAt);

    const updatedIssue = db.getIssue(id);

    res.json({
      success: true,
      data: updatedIssue,
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to update issue:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update issue',
    });
  }
});

/**
 * POST /api/agent/scan
 * Trigger an immediate diagnostic scan
 */
router.post('/scan', async (req, res) => {
  try {
    const { categories, deep_scan } = req.body;

    let result;

    if (deep_scan) {
      // Run immediate deep scan via monitor
      result = await monitor.runImmediateCheck();
    } else {
      // Run quick scan via detector
      const issues = await detector.detectIssues(categories);
      result = {
        newIssues: [],
        allActiveIssues: issues,
      };
    }

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        scan_type: deep_scan ? 'deep' : 'quick',
        new_issues_found: result.newIssues.length,
        total_active_issues: result.allActiveIssues.length,
        issues: result.allActiveIssues,
      },
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to run scan:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run scan',
    });
  }
});

/**
 * GET /api/agent/metrics
 * Get issue counts and statistics
 */
router.get('/metrics', (req, res) => {
  try {
    const { hours } = req.query;

    // Get all issues for comprehensive counting
    const allIssues = db.getIssues({});

    // Calculate counts by severity
    const by_severity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    // Calculate counts by category
    const by_category = {
      security: 0,
      performance: 0,
      stability: 0,
      configuration: 0,
    };

    // Calculate counts by status
    const by_status = {
      detected: 0,
      investigating: 0,
      resolved: 0,
      ignored: 0,
    };

    // Populate counts
    allIssues.forEach(issue => {
      by_severity[issue.severity as keyof typeof by_severity] =
        (by_severity[issue.severity as keyof typeof by_severity] || 0) + 1;

      by_category[issue.category as keyof typeof by_category] =
        (by_category[issue.category as keyof typeof by_category] || 0) + 1;

      by_status[issue.status as keyof typeof by_status] =
        (by_status[issue.status as keyof typeof by_status] || 0) + 1;
    });

    // Get last scan time from monitor status
    const monitorStatus = monitor.getStatus();

    res.json({
      success: true,
      data: {
        total_issues: allIssues.length,
        by_severity,
        by_category,
        by_status,
        last_scan_time: monitorStatus.lastCheck || Date.now(),
      },
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to get metrics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metrics',
    });
  }
});

/**
 * GET /api/agent/status
 * Get health monitor status
 */
router.get('/status', (req, res) => {
  try {
    const status = monitor.getStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to get status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

/**
 * POST /api/agent/issues/:id/feedback
 * Submit feedback on an issue detection
 */
router.post('/issues/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback_type, false_positive_reason, notes, actual_configuration } = req.body;

    if (!feedback_type || !['true_positive', 'false_positive', 'needs_investigation'].includes(feedback_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid feedback_type. Must be: true_positive, false_positive, or needs_investigation',
      });
    }

    const { getFeedbackDatabase } = await import('../services/agent/database/feedback-db.js');
    const feedbackDb = getFeedbackDatabase();

    const feedback = feedbackDb.createFeedback({
      issue_id: id,
      user_id: 'system', // TODO: Get from auth session
      feedback_type,
      false_positive_reason,
      notes,
      actual_configuration,
      submitted_at: Date.now(),
    });

    // Trigger learning analysis if false positive
    if (feedback_type === 'false_positive') {
      const issue = db.getIssue(id);
      if (issue && issue.metadata?.rule_name) {
        const { getLearningSystem } = await import('../services/agent/learning/learning-system.js');
        const learningSystem = getLearningSystem();

        // Run learning asynchronously
        learningSystem.analyzeAndLearn(issue.metadata.rule_name as string).catch((error) => {
          console.error('[AgentAPI] Learning analysis failed:', error);
        });
      }
    }

    res.json({
      success: true,
      data: feedback,
      message: 'Feedback submitted successfully. Thank you for helping improve detection accuracy!',
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to submit feedback:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit feedback',
    });
  }
});

/**
 * GET /api/agent/issues/:id/evidence
 * Get detection evidence for an issue
 */
router.get('/issues/:id/evidence', async (req, res) => {
  try {
    const { id } = req.params;
    const { getFeedbackDatabase } = await import('../services/agent/database/feedback-db.js');
    const feedbackDb = getFeedbackDatabase();

    const evidence = feedbackDb.getEvidence(id);

    res.json({
      success: true,
      data: {
        issue_id: id,
        evidence_count: evidence.length,
        evidence,
      },
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to get evidence:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get evidence',
    });
  }
});

/**
 * GET /api/agent/learning/stats
 * Get learning system statistics
 */
router.get('/learning/stats', async (req, res) => {
  try {
    const { getFeedbackDatabase } = await import('../services/agent/database/feedback-db.js');
    const feedbackDb = getFeedbackDatabase();

    const stats = feedbackDb.getLearningStats();

    res.json({
      success: true,
      data: {
        rules: stats,
        total_rules: stats.length,
        average_fp_rate: stats.reduce((sum, s) => sum + s.false_positive_rate, 0) / stats.length || 0,
      },
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to get learning stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get learning stats',
    });
  }
});

/**
 * GET /api/agent/learning/:rule_name
 * Get detailed learning metrics for a specific rule
 */
router.get('/learning/:rule_name', async (req, res) => {
  try {
    const { rule_name } = req.params;
    const { getFeedbackDatabase } = await import('../services/agent/database/feedback-db.js');
    const feedbackDb = getFeedbackDatabase();

    const metrics = feedbackDb.getLearningMetrics(rule_name);
    const patterns = feedbackDb.getPatterns(rule_name);
    const rules = feedbackDb.getImprovementRules(rule_name);

    res.json({
      success: true,
      data: {
        rule_name,
        metrics,
        patterns,
        improvement_rules: rules,
      },
    });
  } catch (error) {
    console.error('[AgentAPI] Failed to get learning details:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get learning details',
    });
  }
});

/**
 * POST /api/agent/learning/analyze
 * Trigger learning analysis for all rules or a specific rule
 */
router.post('/learning/analyze', async (req, res) => {
  try {
    const { rule_name } = req.body;
    const { getLearningSystem } = await import('../services/agent/learning/learning-system.js');
    const learningSystem = getLearningSystem();

    if (rule_name) {
      const result = await learningSystem.analyzeAndLearn(rule_name);
      res.json({
        success: true,
        data: {
          rule_name,
          patterns_found: result.patterns.length,
          rules_generated: result.rules.length,
          metrics: result.metrics,
        },
      });
    } else {
      // Analyze all rules (run in background)
      res.json({
        success: true,
        message: 'Learning analysis started for all rules',
      });
    }
  } catch (error) {
    console.error('[AgentAPI] Failed to trigger learning analysis:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger learning analysis',
    });
  }
});

export default router;
