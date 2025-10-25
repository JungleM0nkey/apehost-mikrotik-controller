import React from 'react';
import { Row, Col, Alert, Spin } from 'antd';
import { useAnalyticsData } from '../../hooks/useAnalyticsData';
import { SystemMetricsCards } from '../../components/organisms/AnalyticsCharts/SystemMetricsCards';
import { NetworkTrafficChart } from '../../components/organisms/AnalyticsCharts/NetworkTrafficChart';
import { CpuMemoryChart } from '../../components/organisms/AnalyticsCharts/CpuMemoryChart';
import { InterfaceDistributionChart } from '../../components/organisms/AnalyticsCharts/InterfaceDistributionChart';
import { TopInterfacesChart } from '../../components/organisms/AnalyticsCharts/TopInterfacesChart';
import styles from './AnalyticsPage.module.css';

export const AnalyticsPage: React.FC = () => {
  const { data, loading, error } = useAnalyticsData();

  // Show error if data collection failed
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Alert
          message="Error Loading Analytics"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  // Show loading state on initial load
  if (loading && !data) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" tip="Initializing analytics..." />
      </div>
    );
  }

  // Show message if no data available yet
  if (!data) {
    return (
      <div className={styles.noDataContainer}>
        <Alert
          message="No Data Available"
          description="Analytics data is being collected. Please wait a moment."
          type="info"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className={styles.analyticsPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.subtitle}>Real-time system metrics and network analytics</p>
      </div>

      {/* System Metrics Summary Cards */}
      <SystemMetricsCards
        cpuLoad={data.currentMetrics.cpuLoad}
        memoryPercentage={data.currentMetrics.memoryPercentage}
        diskPercentage={data.currentMetrics.diskPercentage}
        uptime={data.currentMetrics.uptime}
        activeInterfaces={data.currentMetrics.activeInterfaces}
      />

      {/* Network Traffic Chart */}
      <Row gutter={[16, 16]} className={styles.chartRow}>
        <Col span={24}>
          <NetworkTrafficChart
            data={data.networkTraffic}
            loading={false}
          />
        </Col>
      </Row>

      {/* CPU/Memory and Top Interfaces */}
      <Row gutter={[16, 16]} className={styles.chartRow}>
        <Col xs={24} lg={12}>
          <CpuMemoryChart
            data={data.systemMetrics}
            loading={false}
          />
        </Col>
        <Col xs={24} lg={12}>
          <TopInterfacesChart
            data={data.interfaceDistribution}
            loading={false}
          />
        </Col>
      </Row>

      {/* Interface Distribution */}
      <Row gutter={[16, 16]} className={styles.chartRow}>
        <Col xs={24} lg={12}>
          <InterfaceDistributionChart
            data={data.interfaceDistribution}
            loading={false}
          />
        </Col>
      </Row>
    </div>
  );
};
