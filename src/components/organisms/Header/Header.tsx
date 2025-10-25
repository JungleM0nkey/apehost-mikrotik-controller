import React, { useState, useEffect } from 'react';
import { ServiceControl, ServiceInfo } from '../../molecules/ServiceControl/ServiceControl';
import api from '../../../services/api';
import styles from './Header.module.css';

export interface HeaderProps {
  currentPage: string;
}

export const Header: React.FC<HeaderProps> = ({ currentPage }) => {
  const [frontendStatus, setFrontendStatus] = useState<'online' | 'offline'>('online');
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
  const [frontendInfo, setFrontendInfo] = useState<ServiceInfo | undefined>();
  const [backendInfo, setBackendInfo] = useState<ServiceInfo | undefined>();

  const fetchServiceInfo = async () => {
    try {
      const response = await fetch('/api/service/info');
      const data = await response.json();
      setBackendInfo(data);
      setBackendStatus('online');
    } catch (error) {
      console.error('Failed to fetch backend service info:', error);
      setBackendStatus('offline');
      setBackendInfo(undefined);
    }
  };

  const checkBackendConnection = async () => {
    try {
      await api.getRouterStatus();
      setBackendStatus('online');
    } catch (error) {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    // Frontend is always online if this code is running
    setFrontendStatus('online');

    // Set frontend info
    const frontendPort = window.location.port || '5173';
    const frontendHost = window.location.hostname;
    setFrontendInfo({
      service: 'frontend',
      status: 'online',
      addresses: [frontendHost],
      port: frontendPort,
    });

    // Initial backend check and info fetch
    checkBackendConnection();
    fetchServiceInfo();

    // Check backend every 5 seconds
    const interval = setInterval(() => {
      checkBackendConnection();
      fetchServiceInfo();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleBackendRestart = async () => {
    try {
      setBackendStatus('connecting');
      await fetch('/api/service/restart', { method: 'POST' });

      // Wait 2 seconds before checking status
      setTimeout(() => {
        checkBackendConnection();
        fetchServiceInfo();
      }, 2000);
    } catch (error) {
      console.error('Failed to restart backend:', error);
      setBackendStatus('offline');
    }
  };

  const handleBackendShutdown = async () => {
    try {
      await fetch('/api/service/shutdown', { method: 'POST' });
      setBackendStatus('offline');
    } catch (error) {
      console.error('Failed to shutdown backend:', error);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.right}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <ServiceControl
            serviceName="Frontend"
            status={frontendStatus}
            serviceInfo={frontendInfo}
          />
          <ServiceControl
            serviceName="Backend"
            status={backendStatus}
            serviceInfo={backendInfo}
            onRestart={handleBackendRestart}
            onShutdown={handleBackendShutdown}
            onRefresh={fetchServiceInfo}
          />
        </div>
      </div>
    </header>
  );
};
