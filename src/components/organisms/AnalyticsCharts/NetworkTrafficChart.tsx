import React, { useMemo } from 'react';
import { Card } from 'antd';
import { Line } from '@ant-design/plots';
import dayjs from 'dayjs';
import type { NetworkTrafficDataPoint } from '../../../types/analytics';
import { getCommonChartConfig } from './chartTheme';
import styles from './AnalyticsChart.module.css';

interface NetworkTrafficChartProps {
  data: NetworkTrafficDataPoint[];
  loading?: boolean;
}

/**
 * Format bytes per second to human-readable format
 */
const formatBps = (bps: number): string => {
  if (bps >= 1000000000) {
    return `${(bps / 1000000000).toFixed(2)} Gbps`;
  } else if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(2)} Mbps`;
  } else if (bps >= 1000) {
    return `${(bps / 1000).toFixed(2)} Kbps`;
  }
  return `${bps.toFixed(2)} bps`;
};

export const NetworkTrafficChart: React.FC<NetworkTrafficChartProps> = ({
  data,
  loading = false,
}) => {
  // Transform data for the chart
  const chartData = useMemo(() => {
    const transformed: Array<{ timestamp: string; type: string; value: number }> = [];

    data.forEach((point) => {
      transformed.push({
        timestamp: point.timestamp,
        type: 'Download',
        value: point.rxRate,
      });
      transformed.push({
        timestamp: point.timestamp,
        type: 'Upload',
        value: point.txRate,
      });
    });

    return transformed;
  }, [data]);

  const config = {
    ...getCommonChartConfig(),
    data: chartData,
    xField: 'timestamp',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    color: ['#ff6b35', '#ff8c61'], // Primary orange for download, Light orange for upload
    lineStyle: {
      lineWidth: 2,
    },
    point: {
      size: 0,
      shape: 'circle',
    },
    xAxis: {
      type: 'time' as const,
      label: {
        formatter: (text: string) => dayjs(text).format('HH:mm:ss'),
        style: {
          fill: '#a0a0a0',
          fontSize: 11,
        },
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
    yAxis: {
      label: {
        formatter: (text: string) => formatBps(parseFloat(text)),
        style: {
          fill: '#a0a0a0',
          fontSize: 11,
        },
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
      formatter: (datum: { type: string; value: number; timestamp: string }) => {
        return {
          name: datum.type,
          value: formatBps(datum.value),
        };
      },
      title: (title: string) => dayjs(title).format('HH:mm:ss'),
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
      title="Network Traffic (Real-time)"
      className={styles.chartCard}
      loading={loading}
    >
      {chartData.length > 0 ? (
        <Line {...config} />
      ) : (
        <div className={styles.noData}>
          <p>No traffic data available</p>
          <p className={styles.noDataSubtext}>Waiting for network activity...</p>
        </div>
      )}
    </Card>
  );
};
