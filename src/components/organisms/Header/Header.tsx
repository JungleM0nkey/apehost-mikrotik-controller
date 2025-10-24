import React from 'react';
import styles from './Header.module.css';

export interface HeaderProps {
  routerName: string;
  connectionStatus: 'online' | 'offline' | 'connecting';
  currentPage: string;
}

export const Header: React.FC<HeaderProps> = ({
  routerName,
  connectionStatus,
  currentPage
}) => {
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
            {statusLabels[connectionStatus]} to {routerName}
          </span>
        </div>

        <div className={styles.userProfile}>
          <div className={styles.avatar}>👤</div>
          <span className={styles.username}>Admin</span>
        </div>
      </div>
    </header>
  );
};
