import React, { useState } from 'react';
import { Tabs, Alert, Spin, Statistic } from 'antd';
import {
  SyncOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { IssueTable } from '../../components/organisms/IssueTable/IssueTable';
import { Button } from '../../components/atoms/Button/Button';
import { useAgentIssues } from '../../hooks/useAgentIssues';
import styles from './AgentPage.module.css';

const categoryIcons = {
  security: <SafetyOutlined />,
  performance: <ThunderboltOutlined />,
  stability: <ToolOutlined />,
  configuration: <SettingOutlined />,
};

export const AgentPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const { issues, metrics, loading, error, refreshIssues, updateIssueStatus, triggerScan, scanning } = useAgentIssues({
    autoRefresh: true,
    refreshInterval: 60000, // 1 minute
  });

  const handleScan = async (deepScan: boolean) => {
    await triggerScan(deepScan);
  };

  const getFilteredIssues = () => {
    switch (activeTab) {
      case 'all':
        return issues;
      case 'detected':
        return issues.filter(i => i.status === 'detected');
      case 'investigating':
        return issues.filter(i => i.status === 'investigating');
      case 'resolved':
        return issues.filter(i => i.status === 'resolved');
      case 'critical':
        return issues.filter(i => i.severity === 'critical');
      case 'high':
        return issues.filter(i => i.severity === 'high');
      default:
        return issues;
    }
  };

  const filteredIssues = getFilteredIssues();

  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          All Issues {metrics && `(${metrics.total_issues})`}
        </span>
      ),
    },
    {
      key: 'detected',
      label: (
        <span>
          <WarningOutlined /> Detected {metrics && `(${metrics.by_status.detected})`}
        </span>
      ),
    },
    {
      key: 'investigating',
      label: (
        <span>
          Investigating {metrics && `(${metrics.by_status.investigating})`}
        </span>
      ),
    },
    {
      key: 'critical',
      label: (
        <span>
          Critical {metrics && `(${metrics.by_severity.critical})`}
        </span>
      ),
    },
    {
      key: 'high',
      label: (
        <span>
          High {metrics && `(${metrics.by_severity.high})`}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <ExclamationCircleOutlined /> AI Agent Diagnostics
          </h1>
          {metrics && (
            <span className={styles.lastScan}>
              Last scan: {new Date(metrics.last_scan_time).toLocaleString()}
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" size="medium" onClick={refreshIssues} disabled={loading}>
            <SyncOutlined spin={loading} /> Refresh
          </Button>
          <Button variant="secondary" size="medium" onClick={() => handleScan(false)} disabled={scanning}>
            {scanning ? <SyncOutlined spin /> : null} Quick Scan
          </Button>
          <Button variant="primary" size="medium" onClick={() => handleScan(true)} disabled={scanning}>
            {scanning ? <SyncOutlined spin /> : null} Deep Scan
          </Button>
        </div>
      </header>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          className={styles.alert}
        />
      )}

      {metrics && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <Statistic
              title="Total Issues"
              value={metrics.total_issues}
              prefix={<ExclamationCircleOutlined />}
            />
          </div>
          <div className={styles.statCard}>
            <Statistic
              title="Critical"
              value={metrics.by_severity.critical}
              valueStyle={{ color: '#ef4444' }}
            />
          </div>
          <div className={styles.statCard}>
            <Statistic
              title="High"
              value={metrics.by_severity.high}
              valueStyle={{ color: '#f59e0b' }}
            />
          </div>
          <div className={styles.statCard}>
            <Statistic
              title="Security"
              value={metrics.by_category.security}
              prefix={categoryIcons.security}
            />
          </div>
          <div className={styles.statCard}>
            <Statistic
              title="Performance"
              value={metrics.by_category.performance}
              prefix={categoryIcons.performance}
            />
          </div>
          <div className={styles.statCard}>
            <Statistic
              title="Stability"
              value={metrics.by_category.stability}
              prefix={categoryIcons.stability}
            />
          </div>
        </div>
      )}

      <div className={styles.content}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className={styles.tabs}
        />

        {loading && !issues.length ? (
          <div className={styles.loadingState}>
            <Spin size="large" />
            <p>Loading diagnostics...</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className={styles.emptyState}>
            <CheckCircleOutlined className={styles.emptyIcon} />
            <h2>No Issues Found</h2>
            <p>Your router is running smoothly with no detected issues.</p>
          </div>
        ) : (
          <IssueTable issues={filteredIssues} onStatusChange={updateIssueStatus} />
        )}
      </div>
    </div>
  );
};
