import React, { useState, useEffect } from 'react';
import { Progress, Badge, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../../services/api';
import websocket from '../../services/websocket';
import type { RouterStatus, NetworkInterface } from '../../types/api';
import { TrafficIndicator } from '../../components/atoms/TrafficIndicator/TrafficIndicator';
import styles from './DashboardPage.module.css';

interface StatCardProps {
  title: string;
  value: string;
  unit?: string;
  status?: 'good' | 'warning' | 'critical';
  icon: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, unit, status = 'good', icon }) => {
  return (
    <div className={`${styles.statCard} ${styles[status]}`}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statContent}>
        <h3 className={styles.statTitle}>{title}</h3>
        <div className={styles.statValue}>
          {value}
          {unit && <span className={styles.statUnit}>{unit}</span>}
        </div>
      </div>
    </div>
  );
};

interface ProgressStatCardProps {
  title: string;
  percentage: number;
  details: string;
  icon: string;
}

const ProgressStatCard: React.FC<ProgressStatCardProps> = ({ title, percentage, details, icon }) => {
  const getStatus = (percent: number): 'good' | 'warning' | 'critical' => {
    if (percent < 60) return 'good';
    if (percent < 80) return 'warning';
    return 'critical';
  };

  const getStrokeColor = (percent: number): string => {
    if (percent < 60) return '#10b981';
    if (percent < 80) return '#f59e0b';
    return '#ef4444';
  };

  const status = getStatus(percentage);

  return (
    <div className={`${styles.statCard} ${styles[status]}`}>
      <div className={styles.progressContainer}>
        <Progress
          type="circle"
          percent={Math.round(percentage)}
          strokeColor={getStrokeColor(percentage)}
          trailColor="var(--color-bg-tertiary)"
          strokeWidth={8}
          width={100}
          format={(percent) => (
            <div className={styles.progressText}>
              <div className={styles.progressPercent}>{percent}%</div>
              <div className={styles.progressIcon}>{icon}</div>
            </div>
          )}
        />
      </div>
      <div className={styles.progressInfo}>
        <h3 className={styles.statTitle}>{title}</h3>
        <div className={styles.progressDetails}>{details}</div>
      </div>
    </div>
  );
};

interface InterfaceItemProps {
  name: string;
  status: 'up' | 'down';
  rx: string;
  tx: string;
  rxRate: number;
  txRate: number;
}

const InterfaceItem: React.FC<InterfaceItemProps> = ({ name, status, rx, tx, rxRate, txRate }) => {
  const isActive = status === 'up';

  return (
    <div className={styles.interfaceItem}>
      <div className={styles.interfaceStatus}>
        <Badge
          status={isActive ? 'success' : 'default'}
          text={<span className={styles.interfaceName}>{name}</span>}
        />
      </div>
      <div className={styles.interfaceStats}>
        <span className={isActive ? styles.interfaceRx : styles.interfaceInactive}>
          <TrafficIndicator direction="rx" rate={rxRate} active={isActive} />
          ↓ {rx}
        </span>
        <span className={isActive ? styles.interfaceTx : styles.interfaceInactive}>
          <TrafficIndicator direction="tx" rate={txRate} active={isActive} />
          ↑ {tx}
        </span>
      </div>
    </div>
  );
};

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

// Format uptime to readable format
const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
};

export const DashboardPage: React.FC = () => {
  const [routerStatus, setRouterStatus] = useState<RouterStatus | null>(null);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRouterStatus = async () => {
    try {
      const status = await api.getRouterStatus();
      setRouterStatus(status);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch router status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load router status');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [status, ifaces] = await Promise.all([
        api.getRouterStatus(),
        api.getInterfaces()
      ]);

      setRouterStatus(status);
      setInterfaces(ifaces);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial data fetch
    fetchData();

    // Connect to WebSocket and subscribe to interface updates
    let cleanupInterfaces: (() => void) | undefined;
    let cleanupErrors: (() => void) | undefined;

    const setupWebSocket = async () => {
      try {
        await websocket.connect();
        console.log('[Dashboard] WebSocket connected, subscribing to interfaces');

        // Subscribe to interface updates with 1-second interval
        websocket.subscribeToInterfaces(1000);

        // Listen for interface updates
        cleanupInterfaces = websocket.onInterfacesUpdate((data) => {
          console.log('[Dashboard] Received interface update:', data.interfaces.length, 'interfaces');
          setInterfaces(data.interfaces);
          setLoading(false);
        });

        // Listen for errors
        cleanupErrors = websocket.onInterfacesError((data) => {
          console.error('[Dashboard] Interface update error:', data.error);
          setError(`Interface update error: ${data.error}`);
        });
      } catch (err) {
        console.error('[Dashboard] WebSocket connection failed:', err);
        setError('Failed to connect to real-time updates');
      }
    };

    setupWebSocket();

    // Refresh router status every 5 seconds (less frequently than interfaces)
    const statusInterval = setInterval(fetchRouterStatus, 5000);

    return () => {
      console.log('[Dashboard] Cleaning up WebSocket subscriptions');

      // Unsubscribe from interface updates
      if (websocket.isConnected()) {
        try {
          websocket.unsubscribeFromInterfaces();
        } catch (err) {
          console.warn('[Dashboard] Failed to unsubscribe:', err);
        }
      }

      // Clean up event listeners
      if (cleanupInterfaces) cleanupInterfaces();
      if (cleanupErrors) cleanupErrors();

      // Clear router status polling
      clearInterval(statusInterval);
    };
  }, []);

  if (loading && !routerStatus) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dashboard data...</div>
      </div>
    );
  }

  if (error && !routerStatus) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          Error: {error}
          <button onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  if (!routerStatus) return null;

  const memoryPercentage = (routerStatus.memoryUsed / routerStatus.memoryTotal) * 100;
  // rxRate and txRate are in bytes per second, convert to Mbps (megabits per second)
  const totalTrafficBytesPerSec = interfaces.reduce((sum, iface) => sum + iface.rxRate + iface.txRate, 0);
  const totalTrafficMbps = (totalTrafficBytesPerSec * 8) / 1000000; // Convert bytes/sec to Mbps

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Real-time router statistics and monitoring</p>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <ProgressStatCard
          title="CPU Usage"
          percentage={routerStatus.cpuLoad}
          details={
            routerStatus.cpuArchitecture
              ? `${routerStatus.cpuArchitecture}${routerStatus.cpuCount ? ` (${routerStatus.cpuCount} core${routerStatus.cpuCount > 1 ? 's' : ''})` : ''}`
              : `${routerStatus.cpuLoad}% utilization`
          }
          icon="CPU"
        />
        <ProgressStatCard
          title="Memory"
          percentage={memoryPercentage}
          details={`${(routerStatus.memoryUsed / 1024 / 1024 / 1024).toFixed(2)} GB / ${(routerStatus.memoryTotal / 1024 / 1024 / 1024).toFixed(2)} GB`}
          icon="MEM"
        />
        <StatCard
          title="Uptime"
          value={formatUptime(routerStatus.uptime)}
          status="good"
          icon="UP"
        />
        <StatCard
          title="Traffic"
          value={totalTrafficMbps.toFixed(1)}
          unit="Mbps"
          status={totalTrafficMbps > 100 ? 'warning' : 'good'}
          icon="NET"
        />
      </div>

      {/* Interfaces Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Network Interfaces</h2>
          <div className={styles.sectionTags}>
            <Tag icon={<CheckCircleOutlined />} color="success">
              {interfaces.filter(i => i.status === 'up').length} Active
            </Tag>
            <Tag icon={<CloseCircleOutlined />} color="default">
              {interfaces.filter(i => i.status === 'down').length} Inactive
            </Tag>
          </div>
        </div>
        <div className={styles.interfacesList}>
          {interfaces.map((iface) => (
            <InterfaceItem
              key={iface.id}
              name={iface.name}
              status={iface.status}
              rx={formatBytes(iface.rxBytes)}
              tx={formatBytes(iface.txBytes)}
              rxRate={iface.rxRate}
              txRate={iface.txRate}
            />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.quickActions}>
          <button className={styles.actionButton} onClick={fetchData}>
            <span className={styles.actionIcon}>REF</span>
            <span>Refresh Stats</span>
          </button>
          <button className={styles.actionButton}>
            <span className={styles.actionIcon}>LOG</span>
            <span>View Logs</span>
          </button>
          <button className={styles.actionButton}>
            <span className={styles.actionIcon}>BAK</span>
            <span>Backup Config</span>
          </button>
          <button className={styles.actionButton}>
            <span className={styles.actionIcon}>DIA</span>
            <span>Run Diagnostics</span>
          </button>
        </div>
      </div>
    </div>
  );
};
