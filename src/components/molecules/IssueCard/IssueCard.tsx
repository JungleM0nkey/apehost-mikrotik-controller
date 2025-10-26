import React from 'react';
import { Card, Tag } from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { SeverityBadge } from '../../atoms/SeverityBadge/SeverityBadge';
import { Button } from '../../atoms/Button/Button';
import type { Issue } from '../../../types/agent';
import styles from './IssueCard.module.css';

interface IssueCardProps {
  issue: Issue;
  onStatusChange?: (id: string, status: 'investigating' | 'resolved' | 'ignored') => void;
}

const categoryIcons = {
  security: '🛡️',
  performance: '⚡',
  stability: '🔧',
  configuration: '⚙️',
};

const statusConfig = {
  detected: {
    icon: <WarningOutlined />,
    label: 'Detected',
    color: '#f59e0b',
  },
  investigating: {
    icon: <ClockCircleOutlined />,
    label: 'Investigating',
    color: '#3b82f6',
  },
  resolved: {
    icon: <CheckCircleOutlined />,
    label: 'Resolved',
    color: '#10b981',
  },
  ignored: {
    icon: <EyeInvisibleOutlined />,
    label: 'Ignored',
    color: '#6b7280',
  },
};

export const IssueCard: React.FC<IssueCardProps> = ({ issue, onStatusChange }) => {
  const statusInfo = statusConfig[issue.status];
  const categoryIcon = categoryIcons[issue.category];

  const handleStatusChange = (newStatus: 'investigating' | 'resolved' | 'ignored') => {
    if (onStatusChange) {
      onStatusChange(issue.id, newStatus);
    }
  };

  return (
    <Card className={`${styles.issueCard} ${styles[issue.severity]}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.categoryIcon}>{categoryIcon}</span>
          <h3 className={styles.title}>{issue.title}</h3>
        </div>
        <div className={styles.headerRight}>
          <SeverityBadge severity={issue.severity} />
        </div>
      </div>

      <div className={styles.content}>
        <p className={styles.description}>{issue.description}</p>

        <div className={styles.metadata}>
          <Tag color={statusInfo.color} icon={statusInfo.icon} className={styles.statusTag}>
            {statusInfo.label}
          </Tag>
          <span className={styles.category}>
            Category: {issue.category.charAt(0).toUpperCase() + issue.category.slice(1)}
          </span>
          <span className={styles.confidence}>
            Confidence: {Math.round(issue.confidence_score * 100)}%
          </span>
        </div>

        {issue.recommendation && (
          <div className={styles.recommendation}>
            <strong>Recommendation:</strong>
            <p>{issue.recommendation}</p>
          </div>
        )}

        <div className={styles.timestamp}>
          Detected: {new Date(issue.detected_at).toLocaleString()}
          {issue.resolved_at && (
            <> • Resolved: {new Date(issue.resolved_at).toLocaleString()}</>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        {issue.status === 'detected' && (
          <>
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleStatusChange('investigating')}
            >
              Investigate
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleStatusChange('ignored')}
            >
              Ignore
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={() => handleStatusChange('resolved')}
            >
              Mark Resolved
            </Button>
          </>
        )}

        {issue.status === 'investigating' && (
          <>
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleStatusChange('ignored')}
            >
              Ignore
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={() => handleStatusChange('resolved')}
            >
              Mark Resolved
            </Button>
          </>
        )}

        {(issue.status === 'resolved' || issue.status === 'ignored') && (
          <Button
            variant="secondary"
            size="small"
            onClick={() => handleStatusChange('investigating')}
          >
            Reopen
          </Button>
        )}
      </div>
    </Card>
  );
};
