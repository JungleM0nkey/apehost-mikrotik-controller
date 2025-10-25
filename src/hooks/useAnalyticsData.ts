import { useState, useEffect, useCallback } from 'react';
import { analyticsService } from '../services/analyticsService';
import type { AnalyticsData } from '../types/analytics';

/**
 * Custom hook for managing analytics data
 */
export const useAnalyticsData = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);

  // Start data collection
  const startCollection = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await analyticsService.startCollection();
      setIsCollecting(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start data collection';
      setError(errorMessage);
      console.error('[useAnalyticsData] Error starting collection:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Stop data collection
  const stopCollection = useCallback(() => {
    analyticsService.stopCollection();
    setIsCollecting(false);
  }, []);

  // Refresh data
  const refreshData = useCallback(async () => {
    try {
      const analyticsData = await analyticsService.getAnalyticsData();
      setData(analyticsData);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh data';
      setError(errorMessage);
      console.error('[useAnalyticsData] Error refreshing data:', err);
    }
  }, []);

  // Clear all data
  const clearData = useCallback(() => {
    analyticsService.clearData();
    setData(null);
  }, []);

  // Start collection on mount
  useEffect(() => {
    startCollection();

    // Refresh data every second
    const interval = setInterval(() => {
      refreshData();
    }, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      stopCollection();
    };
  }, [startCollection, stopCollection, refreshData]);

  return {
    data,
    loading,
    error,
    isCollecting,
    startCollection,
    stopCollection,
    refreshData,
    clearData,
  };
};
