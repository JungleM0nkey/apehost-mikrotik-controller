import { useState, useEffect } from 'react';
import { RouterInfo } from '../types/router';
import { api } from '../services/api';

export const useRouterInfo = () => {
  const [routerInfo, setRouterInfo] = useState<RouterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRouterInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const status = await api.getRouterStatus();

      // Map API status to RouterInfo status type
      const routerStatus: 'online' | 'offline' | 'connecting' =
        status.status === 'online' ? 'online' : 'offline';

      setRouterInfo({
        name: status.name || 'Unknown',
        ipAddress: status.ip || '192.168.100.2',
        status: routerStatus,
        model: status.model || 'Unknown',
        osVersion: status.version || 'Unknown',
        macAddress: status.macAddress,
        subnet: status.subnet
      });
    } catch (err: any) {
      console.error('Failed to fetch router info:', err);
      setError(err.message || 'Failed to connect');
      setRouterInfo({
        name: 'Disconnected',
        ipAddress: '192.168.100.2',
        status: 'offline',
        model: 'Unknown',
        osVersion: 'Unknown'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouterInfo();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRouterInfo, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { routerInfo, loading, error, refetch: fetchRouterInfo };
};
