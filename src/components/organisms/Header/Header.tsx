import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import type { RouterStatus } from '../../../types/api';
import styles from './Header.module.css';

export interface HeaderProps {
  currentPage: string;
}

export const Header: React.FC<HeaderProps> = ({ currentPage }) => {
  const [routerStatus, setRouterStatus] = useState<RouterStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await api.getRouterStatus();
        setRouterStatus(status);
        setConnectionStatus(status.status === 'online' ? 'online' : 'offline');
      } catch (error) {
        console.error('Failed to fetch router status:', error);
        setConnectionStatus('offline');
      }
    };

    checkConnection();
    
    // Check connection every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const statusColors = {
    online: '#10b981',
    offline: '#ef4444',
    connecting: '#f59e0b'
  };

  const statusLabels = {
    online: 'Connected',
    offline: 'Disconnected',
    connecting: 'Connecting...'
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h2 className={styles.pageTitle}>
          {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
        </h2>
      </div>

      <div className={styles.right}>
        <div className={styles.connectionStatus}>
          <span 
            className={styles.statusDot}
            style={{ background: statusColors[connectionStatus] }}
          />
          <span className={styles.statusText}>
            {statusLabels[connectionStatus]} {routerStatus ? `to ${routerStatus.name}` : ''}
          </span>
        </div>

        <div className={styles.userProfile}>
          <div className={styles.avatar}>USR</div>
          <span className={styles.username}>Admin</span>
        </div>
      </div>
    </header>
  );
};
