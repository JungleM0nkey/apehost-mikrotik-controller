import React from 'react';
import { Badge } from 'antd';
import type { IssueSeverity } from '../../../types/agent';
import styles from './SeverityBadge.module.css';

interface SeverityBadgeProps {
  severity: IssueSeverity;
  showLabel?: boolean;
}

const severityConfig = {
  critical: {
    label: 'Critical',
    color: '#ef4444',
    className: styles.critical,
  },
  high: {
    label: 'High',
    color: '#f59e0b',
    className: styles.high,
  },
  medium: {
    label: 'Medium',
    color: '#3b82f6',
    className: styles.medium,
  },
  low: {
    label: 'Low',
    color: '#6b7280',
    className: styles.low,
  },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, showLabel = true }) => {
  const config = severityConfig[severity];

  if (!showLabel) {
    return (
      <Badge
        color={config.color}
        className={config.className}
      />
    );
  }

  return (
    <span className={`${styles.severityBadge} ${config.className}`}>
      <Badge color={config.color} />
      <span className={styles.label}>{config.label}</span>
    </span>
  );
};
