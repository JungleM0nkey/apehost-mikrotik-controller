import React, { useState } from 'react';
import { Tag } from 'antd';
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
import { IssueDetailModal } from '../../molecules/IssueDetailModal/IssueDetailModal';
import type { Issue } from '../../../types/agent';
import styles from './IssueTable.module.css';

interface IssueTableProps {
  issues: Issue[];
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

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
};

export const IssueTable: React.FC<IssueTableProps> = ({ issues, onStatusChange }) => {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleRowClick = (issue: Issue) => {
    setSelectedIssue(issue);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedIssue(null);
  };

  const handleStatusChange = (id: string, status: 'investigating' | 'resolved' | 'ignored') => {
    if (onStatusChange) {
      onStatusChange(id, status);
    }
  };

  return (
    <>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th className={styles.headerCell} style={{ width: '100px' }}>
                Severity
              </th>
              <th className={styles.headerCell} style={{ width: '70px', textAlign: 'center' }}>
                Category
              </th>
              <th className={styles.headerCell} style={{ minWidth: '250px' }}>
                Issue Title
              </th>
              <th className={styles.headerCell} style={{ width: '140px' }}>
                Status
              </th>
              <th className={styles.headerCell} style={{ width: '110px' }}>
                Confidence
              </th>
              <th className={styles.headerCell} style={{ width: '130px' }}>
                Detected
              </th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => {
              const statusInfo = statusConfig[issue.status];
              const categoryIcon = categoryIcons[issue.category];

              return (
                <tr
                  key={issue.id}
                  className={`${styles.row} ${styles[issue.severity]} ${
                    index % 2 === 0 ? styles.evenRow : styles.oddRow
                  } ${issue.status === 'resolved' || issue.status === 'ignored' ? styles.resolvedRow : ''}`}
                  onClick={() => handleRowClick(issue)}
                >
                  <td className={styles.cell}>
                    <SeverityBadge severity={issue.severity} />
                  </td>
                  <td className={`${styles.cell} ${styles.categoryCell}`}>
                    <span className={styles.categoryIcon}>{categoryIcon}</span>
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.title}>{issue.title}</span>
                  </td>
                  <td className={styles.cell}>
                    <Tag color={statusInfo.color} icon={statusInfo.icon} className={styles.statusTag}>
                      {statusInfo.label}
                    </Tag>
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.confidence}>
                      {Math.round(issue.confidence_score * 100)}%
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.timestamp}>{formatRelativeTime(issue.detected_at)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <IssueDetailModal
        issue={selectedIssue}
        open={modalOpen}
        onClose={handleCloseModal}
        onStatusChange={handleStatusChange}
      />
    </>
  );
};
