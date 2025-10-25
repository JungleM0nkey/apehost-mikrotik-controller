import React, { useState, useEffect } from 'react';
import { CloudServerOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { ServiceInfo } from '../../molecules/ServiceControl/ServiceControl';
import { ServerModal } from '../../molecules/ServerModal/ServerModal';
import api from '../../../services/api';
import styles from './Header.module.css';

export interface HeaderProps {
  currentPage: string;
}

export const Header: React.FC<HeaderProps> = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
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
    const backendInterval = setInterval(() => {
      checkBackendConnection();
      fetchServiceInfo();
    }, 5000);

    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(backendInterval);
      clearInterval(timeInterval);
    };
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

  const getTimezone = () => {
    return localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
  };

  const formatTime = () => {
    const timezone = getTimezone();
    return currentTime.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const getServerStatusColor = () => {
    if (backendStatus === 'online') return 'var(--color-accent-success)';
    if (backendStatus === 'connecting') return 'var(--color-accent-warning)';
    return 'var(--color-accent-error)';
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.right}>
          <div className={styles.timeDisplay}>
            <ClockCircleOutlined className={styles.timeIcon} />
            <span className={styles.timeText}>{formatTime()}</span>
          </div>

          <button
            className={styles.serverButton}
            onClick={() => setIsModalOpen(true)}
            title="Server Status"
          >
            <CloudServerOutlined
              className={styles.serverIcon}
              style={{ color: getServerStatusColor() }}
            />
          </button>
        </div>
      </header>

      <ServerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        frontendStatus={frontendStatus}
        backendStatus={backendStatus}
        frontendInfo={frontendInfo}
        backendInfo={backendInfo}
        onBackendRestart={handleBackendRestart}
        onBackendShutdown={handleBackendShutdown}
        onBackendRefresh={fetchServiceInfo}
      />
    </>
  );
};
