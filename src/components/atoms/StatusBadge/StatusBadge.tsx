import React from 'react';
import styles from './StatusBadge.module.css';

export interface StatusBadgeProps {
  status: 'online' | 'offline' | 'connecting';
  label: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  return (
    <div className={styles.badge} role="status" aria-live="polite">
      <span className={`${styles.dot} ${styles[status]}`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
};
