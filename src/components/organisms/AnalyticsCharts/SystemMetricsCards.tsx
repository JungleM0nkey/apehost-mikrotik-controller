import React from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import styles from './SystemMetricsCards.module.css';

interface SystemMetricsCardsProps {
  cpuLoad: number;
  memoryPercentage: number;
  diskPercentage: number;
  uptime: number;
  activeInterfaces: number;
}

/**
 * Format uptime in a human-readable format
 */
const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

/**
 * Get progress bar color based on percentage (orange theme)
 */
const getProgressColor = (percentage: number): string => {
  if (percentage < 50) return '#10b981'; // Green for good performance
  if (percentage < 80) return '#ff6b35'; // Orange for warning
  return '#ef4444'; // Red for critical
};

export const SystemMetricsCards: React.FC<SystemMetricsCardsProps> = ({
  cpuLoad,
  memoryPercentage,
  diskPercentage,
  uptime,
  activeInterfaces,
}) => {
  return (
    <Row gutter={[16, 16]} className={styles.metricsCards}>
      <Col xs={24} sm={12} md={8} lg={4}>
        <Card className={styles.metricCard}>
          <Statistic
            title="CPU Load"
            value={cpuLoad}
            precision={1}
            suffix="%"
            prefix={<DashboardOutlined />}
            valueStyle={{ color: getProgressColor(cpuLoad) }}
          />
          <Progress
            percent={cpuLoad}
            strokeColor={getProgressColor(cpuLoad)}
            showInfo={false}
            className={styles.progress}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={4}>
        <Card className={styles.metricCard}>
          <Statistic
            title="Memory Usage"
            value={memoryPercentage}
            precision={1}
            suffix="%"
            prefix={<DatabaseOutlined />}
            valueStyle={{ color: getProgressColor(memoryPercentage) }}
          />
          <Progress
            percent={memoryPercentage}
            strokeColor={getProgressColor(memoryPercentage)}
            showInfo={false}
            className={styles.progress}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={4}>
        <Card className={styles.metricCard}>
          <Statistic
            title="Disk Usage"
            value={diskPercentage}
            precision={1}
            suffix="%"
            prefix={<DatabaseOutlined />}
            valueStyle={{ color: getProgressColor(diskPercentage) }}
          />
          <Progress
            percent={diskPercentage}
            strokeColor={getProgressColor(diskPercentage)}
            showInfo={false}
            className={styles.progress}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={12} lg={4}>
        <Card className={styles.metricCard}>
          <Statistic
            title="System Uptime"
            value={formatUptime(uptime)}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ fontSize: '18px' }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={12} lg={4}>
        <Card className={styles.metricCard}>
          <Statistic
            title="Active Interfaces"
            value={activeInterfaces}
            prefix={<WifiOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
};
