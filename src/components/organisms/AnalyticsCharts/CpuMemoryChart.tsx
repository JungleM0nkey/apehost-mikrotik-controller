import React, { useMemo } from 'react';
import { Card } from 'antd';
import { Area } from '@ant-design/plots';
import dayjs from 'dayjs';
import type { SystemMetricsDataPoint } from '../../../types/analytics';
import { getCommonChartConfig } from './chartTheme';
import styles from './AnalyticsChart.module.css';

interface CpuMemoryChartProps {
  data: SystemMetricsDataPoint[];
  loading?: boolean;
}

export const CpuMemoryChart: React.FC<CpuMemoryChartProps> = ({
  data,
  loading = false,
}) => {
  // Transform data for the chart
  const chartData = useMemo(() => {
    const transformed: Array<{ timestamp: string; type: string; value: number }> = [];

    data.forEach((point) => {
      transformed.push({
        timestamp: point.timestamp,
        type: 'CPU Load',
        value: point.cpuLoad,
      });
      transformed.push({
        timestamp: point.timestamp,
        type: 'Memory Usage',
        value: point.memoryPercentage,
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
    color: ['#ff6b35', '#f97316'], // Primary orange for CPU, Medium orange for Memory
    areaStyle: {
      fillOpacity: 0.2,
    },
    lineStyle: {
      lineWidth: 2,
    },
    point: {
      size: 0,
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
        formatter: (text: string) => `${text}%`,
        style: {
          fill: '#a0a0a0',
          fontSize: 11,
        },
      },
      max: 100,
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
          value: `${datum.value.toFixed(1)}%`,
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
      title="CPU & Memory Usage"
      className={styles.chartCard}
      loading={loading}
    >
      {chartData.length > 0 ? (
        <Area {...config} />
      ) : (
        <div className={styles.noData}>
          <p>No system metrics available</p>
          <p className={styles.noDataSubtext}>Collecting data...</p>
        </div>
      )}
    </Card>
  );
};
