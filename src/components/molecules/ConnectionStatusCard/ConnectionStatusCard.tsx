import React from 'react';
import { Button } from '../../atoms/Button/Button';
import styles from './ConnectionStatusCard.module.css';

interface ConnectionStatusCardProps {
  title: string;
  status: 'connected' | 'disconnected' | 'testing';
  details?: {
    label: string;
    value: string;
  }[];
  error?: string;
  onTest?: () => void;
  testLoading?: boolean;
}

export const ConnectionStatusCard: React.FC<ConnectionStatusCardProps> = ({
  title,
  status,
  details,
  error,
  onTest,
  testLoading = false,
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{title}</h3>
          <div className={`${styles.statusBadge} ${styles[status]}`}>
            <span className={styles.statusDot}></span>
            <span className={styles.statusText}>
              {status === 'connected' && 'Connected'}
              {status === 'disconnected' && 'Disconnected'}
              {status === 'testing' && 'Testing...'}
            </span>
          </div>
        </div>
        {onTest && (
          <Button
            variant="secondary"
            onClick={onTest}
            disabled={testLoading}
          >
            {testLoading ? 'Testing...' : 'Test Connection'}
          </Button>
        )}
      </div>

      {details && details.length > 0 && (
        <div className={styles.details}>
          {details.map((detail, index) => (
            <div key={index} className={styles.detailRow}>
              <span className={styles.detailLabel}>{detail.label}:</span>
              <span className={styles.detailValue}>{detail.value}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
