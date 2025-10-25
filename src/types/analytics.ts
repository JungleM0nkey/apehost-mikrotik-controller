// Analytics Data Types

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface NetworkTrafficDataPoint {
  timestamp: string;
  rxRate: number;
  txRate: number;
}

export interface InterfaceTrafficDataPoint {
  timestamp: string;
  interfaceName: string;
  rxRate: number;
  txRate: number;
}

export interface SystemMetricsDataPoint {
  timestamp: string;
  cpuLoad: number;
  memoryPercentage: number;
  diskPercentage: number;
}

export interface InterfaceDistribution {
  interface: string;
  rxBytes: number;
  txBytes: number;
  totalBytes: number;
}

export interface AnalyticsData {
  networkTraffic: NetworkTrafficDataPoint[];
  systemMetrics: SystemMetricsDataPoint[];
  interfaceTraffic: InterfaceTrafficDataPoint[];
  interfaceDistribution: InterfaceDistribution[];
  currentMetrics: {
    cpuLoad: number;
    memoryPercentage: number;
    diskPercentage: number;
    uptime: number;
    activeInterfaces: number;
  };
}

export interface AnalyticsConfig {
  maxDataPoints: number;
  updateInterval: number;
  retentionMinutes: number;
}
