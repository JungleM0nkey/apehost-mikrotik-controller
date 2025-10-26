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

export default router;
