import React, { useMemo } from 'react';
import { Card } from 'antd';
import { Column } from '@ant-design/plots';
import type { InterfaceDistribution } from '../../../types/analytics';
import { getCommonChartConfig } from './chartTheme';
import styles from './AnalyticsChart.module.css';

interface TopInterfacesChartProps {
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

export const TopInterfacesChart: React.FC<TopInterfacesChartProps> = ({
  data,
  loading = false,
}) => {
  // Transform and sort data for the chart - top 5 interfaces
  const chartData = useMemo(() => {
    const transformed = data
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .slice(0, 5)
      .map((item) => ({
        interface: item.interface,
        download: item.rxBytes,
        upload: item.txBytes,
      }));

    // Convert to stacked format
    const result: Array<{ interface: string; type: string; value: number }> = [];
    transformed.forEach((item) => {
      result.push({
        interface: item.interface,
        type: 'Download',
        value: item.download,
      });
      result.push({
        interface: item.interface,
        type: 'Upload',
        value: item.upload,
      });
    });

    return result;
  }, [data]);

  const config = {
    ...getCommonChartConfig(),
    data: chartData,
    xField: 'interface',
    yField: 'value',
    seriesField: 'type',
    isStack: true,
    color: ['#ff6b35', '#fb923c'], // Primary orange for download, Peachy orange for upload
    columnStyle: {
      radius: [4, 4, 0, 0],
    },
    xAxis: {
      label: {
        style: {
          fill: '#a0a0a0',
          fontSize: 11,
        },
        formatter: (text: string) => {
          // Truncate long interface names
          return text.length > 12 ? text.substring(0, 12) + '...' : text;
        },
      },
      line: {
        style: {
          stroke: '#2d2d2d',
        },
      },
    },
    yAxis: {
      label: {
        style: {
          fill: '#a0a0a0',
          fontSize: 11,
        },
        formatter: (text: string) => formatBytes(parseFloat(text)),
      },
      line: {
        style: {
          stroke: '#2d2d2d',
        },
      },
      grid: {
        line: {
          style: {
            stroke: '#2d2d2d',
            lineWidth: 0.5,
            lineDash: [4, 4],
          },
        },
      },
    },
    tooltip: {
      formatter: (datum: { interface: string; type: string; value: number }) => {
        return {
          name: datum.type,
          value: formatBytes(datum.value),
        };
      },
    },
    legend: {
      position: 'top-right' as const,
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
      title="Top 5 Interfaces by Bandwidth"
      className={styles.chartCard}
      loading={loading}
    >
      {chartData.length > 0 ? (
        <Column {...config} />
      ) : (
        <div className={styles.noData}>
          <p>No interface data available</p>
          <p className={styles.noDataSubtext}>Waiting for network activity...</p>
        </div>
      )}
    </Card>
  );
};
