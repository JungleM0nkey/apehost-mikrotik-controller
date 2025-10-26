import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import websocket from '../services/websocket';
import type { Issue, AgentMetrics, IssueStatus } from '../types/agent';

interface UseAgentIssuesOptions {
  status?: IssueStatus;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseAgentIssuesReturn {
  issues: Issue[];
  metrics: AgentMetrics | null;
  loading: boolean;
  error: string | null;
  refreshIssues: () => Promise<void>;
  updateIssueStatus: (id: string, status: IssueStatus) => Promise<void>;
  triggerScan: (deepScan?: boolean) => Promise<void>;
  scanning: boolean;
}

export const useAgentIssues = (options: UseAgentIssuesOptions = {}): UseAgentIssuesReturn => {
  const { status, autoRefresh = false, refreshInterval = 60000 } = options;

  const [issues, setIssues] = useState<Issue[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (status) {
        params.append('status', status);
      }

      const response = await api.getAgentIssues(params.toString());

      if (response.success && response.data) {
        setIssues(response.data.issues || []);
      } else {
        throw new Error('Failed to fetch issues');
      }
    } catch (err) {
      console.error('[useAgentIssues] Error fetching issues:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  }, [status]);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await api.getAgentMetrics();

      if (response.success && response.data) {
        setMetrics(response.data);
      }
    } catch (err) {
      console.error('[useAgentIssues] Error fetching metrics:', err);
    }
  }, []);

  const refreshIssues = useCallback(async () => {
    await Promise.all([fetchIssues(), fetchMetrics()]);
  }, [fetchIssues, fetchMetrics]);

  const updateIssueStatus = useCallback(async (id: string, newStatus: IssueStatus) => {
    try {
      const response = await api.updateAgentIssueStatus(id, newStatus);

      if (response.success) {
        // Update local state immediately for better UX
        setIssues(prevIssues =>
          prevIssues.map(issue =>
            issue.id === id
              ? { ...issue, status: newStatus, resolved_at: newStatus === 'resolved' ? Date.now() : undefined }
              : issue
          )
        );

        // Refresh metrics
        await fetchMetrics();
      } else {
        throw new Error('Failed to update issue status');
      }
    } catch (err) {
      console.error('[useAgentIssues] Error updating issue status:', err);
      // Refresh to get correct state from server
      await refreshIssues();
    }
  }, [fetchMetrics, refreshIssues]);

  const triggerScan = useCallback(async (deepScan: boolean = false) => {
    try {
      setScanning(true);
      setError(null);

      const response = await api.triggerAgentScan(deepScan);

      if (response.success) {
        // Refresh issues and metrics after scan
        await refreshIssues();
      } else {
        throw new Error('Failed to trigger scan');
      }
    } catch (err) {
      console.error('[useAgentIssues] Error triggering scan:', err);
      setError(err instanceof Error ? err.message : 'Failed to trigger scan');
    } finally {
      setScanning(false);
    }
  }, [refreshIssues]);

  // Initial fetch
  useEffect(() => {
    refreshIssues();
  }, [refreshIssues]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      refreshIssues();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshIssues]);

  // WebSocket subscriptions
  useEffect(() => {
    const handleNewIssue = (issue: Issue) => {
      console.log('[useAgentIssues] New issue detected:', issue);
      setIssues(prevIssues => [issue, ...prevIssues]);
      fetchMetrics(); // Refresh metrics
    };

    const handleIssueResolved = (data: { id: string; timestamp: number }) => {
      console.log('[useAgentIssues] Issue resolved:', data);
      setIssues(prevIssues =>
        prevIssues.map(issue =>
          issue.id === data.id
            ? { ...issue, status: 'resolved' as IssueStatus, resolved_at: data.timestamp }
            : issue
        )
      );
      fetchMetrics(); // Refresh metrics
    };

    const handleScanComplete = (data: any) => {
      console.log('[useAgentIssues] Scan complete:', data);
      refreshIssues(); // Refresh all data
    };

    // Subscribe to WebSocket events
    websocket.on('agent:newIssue', handleNewIssue);
    websocket.on('agent:issueResolved', handleIssueResolved);
    websocket.on('agent:scanComplete', handleScanComplete);

    // Cleanup
    return () => {
      websocket.off('agent:newIssue', handleNewIssue);
      websocket.off('agent:issueResolved', handleIssueResolved);
      websocket.off('agent:scanComplete', handleScanComplete);
    };
  }, [fetchMetrics, refreshIssues]);

  return {
    issues,
    metrics,
    loading,
    error,
    refreshIssues,
    updateIssueStatus,
    triggerScan,
    scanning,
  };
};
