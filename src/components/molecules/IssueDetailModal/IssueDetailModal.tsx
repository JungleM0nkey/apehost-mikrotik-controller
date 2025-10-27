import React, { useState } from 'react';
import { Modal, Tag, message } from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeInvisibleOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { SeverityBadge } from '../../atoms/SeverityBadge/SeverityBadge';
import { Button } from '../../atoms/Button/Button';
import { FalsePositiveMarker } from '../FalsePositiveMarker';
import type { Issue } from '../../../types/agent';
import type { FeedbackSubmission } from '../FalsePositiveMarker/FalsePositiveMarker';
import styles from './IssueDetailModal.module.css';

interface IssueDetailModalProps {
  issue: Issue | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (id: string, status: 'investigating' | 'resolved' | 'ignored') => void;
}

const categoryIcons = {
  security: <SafetyOutlined />,
  performance: <ThunderboltOutlined />,
  stability: <ToolOutlined />,
  configuration: <SettingOutlined />,
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

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  open,
  onClose,
  onStatusChange,
}) => {
  const [feedbackCount, setFeedbackCount] = useState(0);

  if (!issue) return null;

  const statusInfo = statusConfig[issue.status];
  const categoryIcon = categoryIcons[issue.category];

  const handleStatusChange = (newStatus: 'investigating' | 'resolved' | 'ignored') => {
    if (onStatusChange) {
      onStatusChange(issue.id, newStatus);
      onClose();
    }
  };

  const handleFeedbackSubmit = async (feedback: FeedbackSubmission) => {
    try {
      const response = await fetch(`/api/agent/issues/${issue.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedback),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      const data = await response.json();
      setFeedbackCount(prev => prev + 1);
      message.success('Feedback submitted successfully. The AI will learn from this.');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      message.error('Failed to submit feedback. Please try again.');
    }
  };

  const renderActions = () => {
    if (issue.status === 'detected') {
      return (
        <>
          <Button
            variant="secondary"
            size="medium"
            onClick={() => handleStatusChange('investigating')}
          >
            <ClockCircleOutlined /> Investigate
          </Button>
          <Button
            variant="secondary"
            size="medium"
            onClick={() => handleStatusChange('ignored')}
          >
            <EyeInvisibleOutlined /> Ignore
          </Button>
          <Button
            variant="primary"
            size="medium"
            onClick={() => handleStatusChange('resolved')}
          >
            <CheckCircleOutlined /> Mark Resolved
          </Button>
        </>
      );
    }

    if (issue.status === 'investigating') {
      return (
        <>
          <Button
            variant="secondary"
            size="medium"
            onClick={() => handleStatusChange('ignored')}
          >
            <EyeInvisibleOutlined /> Ignore
          </Button>
          <Button
            variant="primary"
            size="medium"
            onClick={() => handleStatusChange('resolved')}
          >
            <CheckCircleOutlined /> Mark Resolved
          </Button>
        </>
      );
    }

    if (issue.status === 'resolved' || issue.status === 'ignored') {
      return (
        <Button
          variant="secondary"
          size="medium"
          onClick={() => handleStatusChange('investigating')}
        >
          <WarningOutlined /> Reopen
        </Button>
      );
    }

    return null;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      title={
        <div className={styles.modalTitle}>
          <span className={styles.categoryIcon}>{categoryIcon}</span>
          <span>{issue.title}</span>
        </div>
      }
      className={styles.modal}
    >
      <div className={styles.content}>
        <div className={styles.metadataGrid}>
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>Severity</span>
            <SeverityBadge severity={issue.severity} />
          </div>
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>Status</span>
            <Tag color={statusInfo.color} icon={statusInfo.icon}>
              {statusInfo.label}
            </Tag>
          </div>
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>Category</span>
            <span className={styles.metadataValue}>
              {issue.category.charAt(0).toUpperCase() + issue.category.slice(1)}
            </span>
          </div>
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>Confidence</span>
            <span className={styles.metadataValue}>
              {Math.round(issue.confidence_score * 100)}%
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Description</h3>
          <p className={styles.description}>{issue.description}</p>
        </div>

        {issue.recommendation && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Recommendation</h3>
            <div className={styles.recommendation}>
              <p>{issue.recommendation}</p>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <FalsePositiveMarker
            issueId={issue.id}
            onSubmit={handleFeedbackSubmit}
            feedbackCount={feedbackCount}
          />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Timeline</h3>
          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <span className={styles.timelineLabel}>Detected:</span>
              <span className={styles.timelineValue}>
                {new Date(issue.detected_at).toLocaleString()}
              </span>
            </div>
            {issue.resolved_at && (
              <div className={styles.timelineItem}>
                <span className={styles.timelineLabel}>Resolved:</span>
                <span className={styles.timelineValue}>
                  {new Date(issue.resolved_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.actions}>{renderActions()}</div>
      </div>
    </Modal>
  );
};
