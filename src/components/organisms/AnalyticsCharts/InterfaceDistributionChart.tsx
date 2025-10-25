import React, { useMemo } from 'react';
import { Card } from 'antd';
import { Pie } from '@ant-design/plots';
import type { InterfaceDistribution } from '../../../types/analytics';
import { getCommonChartConfig } from './chartTheme';
import styles from './AnalyticsChart.module.css';

interface InterfaceDistributionChartProps {
  data: InterfaceDistribution[];
  loading?: boolean;
}

/**
 * Format bytes to human-readable format
 */
const formatBytes = (bytes: number): string => {
  if (bytes >= 1099511627776) {
    return `${(bytes / 1099511627776).toFixed(2)} TB`;
  } else if (bytes >= 1073741824) {
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  } else if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
};

export const InterfaceDistributionChart: React.FC<InterfaceDistributionChartProps> = ({
  data,
  loading = false,
}) => {
  // Transform data for the chart
  const chartData = useMemo(() => {
    return data.map((item) => ({
      interface: item.interface,
      value: item.totalBytes,
    }));
  }, [data]);

  const config = {
    ...getCommonChartConfig(),
    data: chartData,
    angleField: 'value',
    colorField: 'interface',
    radius: 0.9,
    innerRadius: 0.64,
    label: {
      type: 'outer' as const,
      content: '{name}\n{percentage}',
      style: {
        fill: '#ffffff',
        fontSize: 12,
      },
    },
    interactions: [
      {
        type: 'element-selected',
      },
      {
        type: 'element-active',
      },
    ],
    statistic: {
      title: {
        content: 'Total',
        style: {
          fontSize: '13px',
          color: '#a0a0a0',
          fontWeight: 500,
        },
      },
      content: {
        formatter: () => {
          const total = chartData.reduce((sum, item) => sum + item.value, 0);
          return formatBytes(total);
        },
        style: {
          fontSize: '20px',
          fontWeight: 600,
          color: '#ffffff',
        },
      },
    },
    tooltip: {
      formatter: (datum: { interface: string; value: number }) => {
        return {
          name: datum.interface,
          value: formatBytes(datum.value),
        };
      },
    },
    legend: {
      position: 'bottom' as const,
      itemName: {
        style: {
          fill: '#ffffff',
        },
      },
    },
    height: 320,
  };

  return (
    <Card
      title="Bandwidth Distribution by Interface"
      className={styles.chartCard}
      loading={loading}
    >
      {chartData.length > 0 ? (
        <Pie {...config} />
      ) : (
        <div className={styles.noData}>
          <p>No interface data available</p>
          <p className={styles.noDataSubtext}>Waiting for network activity...</p>
        </div>
      )}
    </Card>
  );
};
