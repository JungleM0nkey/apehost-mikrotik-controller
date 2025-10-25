import { useState, useEffect } from 'react';
import { api } from '../services/api';

export interface LLMStatus {
  configured: boolean;
  provider: string | null;
}

export const useLLMStatus = () => {
  const [llmStatus, setLLMStatus] = useState<LLMStatus>({
    configured: false,
    provider: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLLMStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const health = await api.checkHealth();

      setLLMStatus({
        configured: health.llm?.configured ?? false,
        provider: health.llm?.provider ?? null,
      });
    } catch (err: any) {
      console.error('Failed to fetch LLM status:', err);
      setError(err.message || 'Failed to check LLM configuration');
      setLLMStatus({
        configured: false,
        provider: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLLMStatus();

    // Refresh every 60 seconds (less frequent than router info)
    const interval = setInterval(fetchLLMStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  return { llmStatus, loading, error, refetch: fetchLLMStatus };
};
