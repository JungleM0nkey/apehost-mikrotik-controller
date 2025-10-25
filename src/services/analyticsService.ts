import dayjs from 'dayjs';
import type {
  AnalyticsData,
  AnalyticsConfig,
  NetworkTrafficDataPoint,
  SystemMetricsDataPoint,
  InterfaceTrafficDataPoint,
  InterfaceDistribution
} from '../types/analytics';
import type { NetworkInterface } from '../types/api';
import { api } from './api';
import { websocket, InterfacesUpdateEvent } from './websocket';

/**
 * Analytics Service
 * Manages time-series data collection for charts and analytics
 */
export class AnalyticsService {
  private networkTrafficData: NetworkTrafficDataPoint[] = [];
  private systemMetricsData: SystemMetricsDataPoint[] = [];
  private interfaceTrafficData: InterfaceTrafficDataPoint[] = [];
  private interfaceDistribution: Map<string, InterfaceDistribution> = new Map();

  private config: AnalyticsConfig = {
    maxDataPoints: 60, // Keep 60 data points (1 minute at 1s interval)
    updateInterval: 1000, // Update every second
    retentionMinutes: 5, // Keep 5 minutes of data
  };

  private isCollecting: boolean = false;
  private systemMetricsInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  // WebSocket cleanup functions
  private cleanupFunctions: (() => void)[] = [];

  constructor(config?: Partial<AnalyticsConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Start collecting analytics data
   */
  async startCollection(): Promise<void> {
    if (this.isCollecting) {
      console.log('[Analytics] Already collecting data');
      return;
    }

    console.log('[Analytics] Starting data collection');
    this.isCollecting = true;

    // Connect to WebSocket if not already connected
    if (!websocket.isConnected()) {
      await websocket.connect();
    }

    // Subscribe to real-time interface updates
    this.subscribeToInterfaces();

    // Start polling system metrics
    this.startSystemMetricsCollection();

    // Start cleanup interval to remove old data
    this.startCleanupInterval();

    // Get initial data
    await this.collectInitialData();
  }

  /**
   * Stop collecting analytics data
   */
  stopCollection(): void {
    if (!this.isCollecting) {
      return;
    }

    console.log('[Analytics] Stopping data collection');
    this.isCollecting = false;

    // Stop system metrics polling
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
      this.systemMetricsInterval = null;
    }

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Unsubscribe from WebSocket events
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];

    // Unsubscribe from interface updates
    if (websocket.isConnected()) {
      websocket.unsubscribeFromInterfaces();
    }
  }

  /**
   * Subscribe to real-time interface updates
   */
  private subscribeToInterfaces(): void {
    // Subscribe to interface updates (every 1 second)
    websocket.subscribeToInterfaces(this.config.updateInterval);

    // Listen for interface updates
    const cleanup = websocket.onInterfacesUpdate((event: InterfacesUpdateEvent) => {
      this.handleInterfacesUpdate(event.interfaces);
    });

    this.cleanupFunctions.push(cleanup);
  }

  /**
   * Handle interface updates from WebSocket
   */
  private handleInterfacesUpdate(interfaces: NetworkInterface[]): void {
    const timestamp = dayjs().toISOString();

    // Calculate total network traffic
    let totalRx = 0;
    let totalTx = 0;

    interfaces.forEach(iface => {
      if (iface.status === 'up') {
        totalRx += iface.rxRate;
        totalTx += iface.txRate;

        // Store per-interface traffic data
        this.interfaceTrafficData.push({
          timestamp,
          interfaceName: iface.name,
          rxRate: iface.rxRate,
          txRate: iface.txRate,
        });

        // Update interface distribution
        this.interfaceDistribution.set(iface.id, {
          interface: iface.name,
          rxBytes: iface.rxBytes,
          txBytes: iface.txBytes,
          totalBytes: iface.rxBytes + iface.txBytes,
        });
      }
    });

    // Store network traffic data
    this.networkTrafficData.push({
      timestamp,
      rxRate: totalRx,
      txRate: totalTx,
    });

    // Limit data points
    this.limitDataPoints();
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection(): void {
    // Poll system metrics every second
    this.systemMetricsInterval = setInterval(async () => {
      try {
        const resources = await api.getResources();
        const timestamp = dayjs().toISOString();

        this.systemMetricsData.push({
          timestamp,
          cpuLoad: resources.cpu.load,
          memoryPercentage: resources.memory.percentage,
          diskPercentage: resources.disk.percentage,
        });

        this.limitDataPoints();
      } catch (error) {
        console.error('[Analytics] Error collecting system metrics:', error);
      }
    }, this.config.updateInterval);
  }

  /**
   * Collect initial data
   */
  private async collectInitialData(): Promise<void> {
    try {
      // Get initial system resources
      const resources = await api.getResources();
      const timestamp = dayjs().toISOString();

      this.systemMetricsData.push({
        timestamp,
        cpuLoad: resources.cpu.load,
        memoryPercentage: resources.memory.percentage,
        diskPercentage: resources.disk.percentage,
      });

      // Get initial interfaces
      const interfaces = await api.getInterfaces();
      this.handleInterfacesUpdate(interfaces);
    } catch (error) {
      console.error('[Analytics] Error collecting initial data:', error);
    }
  }

  /**
   * Start cleanup interval to remove old data
   */
  private startCleanupInterval(): void {
    // Clean up old data every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 10000);
  }

  /**
   * Limit data points to max configured value
   */
  private limitDataPoints(): void {
    const maxPoints = this.config.maxDataPoints;

    if (this.networkTrafficData.length > maxPoints) {
      this.networkTrafficData = this.networkTrafficData.slice(-maxPoints);
    }

    if (this.systemMetricsData.length > maxPoints) {
      this.systemMetricsData = this.systemMetricsData.slice(-maxPoints);
    }

    if (this.interfaceTrafficData.length > maxPoints * 10) {
      this.interfaceTrafficData = this.interfaceTrafficData.slice(-maxPoints * 10);
    }
  }

  /**
   * Clean up old data based on retention policy
   */
  private cleanupOldData(): void {
    const cutoffTime = dayjs().subtract(this.config.retentionMinutes, 'minutes');

    this.networkTrafficData = this.networkTrafficData.filter(
      point => dayjs(point.timestamp).isAfter(cutoffTime)
    );

    this.systemMetricsData = this.systemMetricsData.filter(
      point => dayjs(point.timestamp).isAfter(cutoffTime)
    );

    this.interfaceTrafficData = this.interfaceTrafficData.filter(
      point => dayjs(point.timestamp).isAfter(cutoffTime)
    );
  }

  /**
   * Get all analytics data
   */
  async getAnalyticsData(): Promise<AnalyticsData> {
    const currentMetrics = this.systemMetricsData.length > 0
      ? this.systemMetricsData[this.systemMetricsData.length - 1]
      : {
          cpuLoad: 0,
          memoryPercentage: 0,
          diskPercentage: 0,
        };

    // Get uptime from router status
    let uptime = 0;
    let activeInterfaces = 0;

    try {
      const status = await api.getRouterStatus();
      uptime = status.uptime;

      const interfaces = await api.getInterfaces();
      activeInterfaces = interfaces.filter(i => i.status === 'up').length;
    } catch (error) {
      console.error('[Analytics] Error getting current metrics:', error);
    }

    return {
      networkTraffic: this.networkTrafficData,
      systemMetrics: this.systemMetricsData,
      interfaceTraffic: this.interfaceTrafficData,
      interfaceDistribution: Array.from(this.interfaceDistribution.values()),
      currentMetrics: {
        cpuLoad: currentMetrics.cpuLoad,
        memoryPercentage: currentMetrics.memoryPercentage,
        diskPercentage: currentMetrics.diskPercentage,
        uptime,
        activeInterfaces,
      },
    };
  }

  /**
   * Get network traffic data
   */
  getNetworkTrafficData(): NetworkTrafficDataPoint[] {
    return this.networkTrafficData;
  }

  /**
   * Get system metrics data
   */
  getSystemMetricsData(): SystemMetricsDataPoint[] {
    return this.systemMetricsData;
  }

  /**
   * Get interface traffic data
   */
  getInterfaceTrafficData(): InterfaceTrafficDataPoint[] {
    return this.interfaceTrafficData;
  }

  /**
   * Get interface distribution data
   */
  getInterfaceDistribution(): InterfaceDistribution[] {
    return Array.from(this.interfaceDistribution.values());
  }

  /**
   * Clear all collected data
   */
  clearData(): void {
    this.networkTrafficData = [];
    this.systemMetricsData = [];
    this.interfaceTrafficData = [];
    this.interfaceDistribution.clear();
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;
