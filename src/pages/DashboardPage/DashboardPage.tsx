import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import type { RouterStatus, NetworkInterface } from '../../types/api';
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

interface InterfaceItemProps {
  name: string;
  status: 'up' | 'down';
  rx: string;
  tx: string;
}

const InterfaceItem: React.FC<InterfaceItemProps> = ({ name, status, rx, tx }) => {
  return (
    <div className={styles.interfaceItem}>
      <div className={styles.interfaceStatus}>
        <span className={`${styles.statusDot} ${status === 'up' ? styles.statusUp : styles.statusDown}`} />
        <span className={styles.interfaceName}>{name}</span>
      </div>
      <div className={styles.interfaceStats}>
        <span className={styles.interfaceRx}>↓ {rx}</span>
        <span className={styles.interfaceTx}>↑ {tx}</span>
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

// Determine status based on percentage
const getStatus = (percentage: number): 'good' | 'warning' | 'critical' => {
  if (percentage < 60) return 'good';
  if (percentage < 80) return 'warning';
  return 'critical';
};

export const DashboardPage: React.FC = () => {
  const [routerStatus, setRouterStatus] = useState<RouterStatus | null>(null);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    fetchData();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    
    return () => clearInterval(interval);
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
  const totalTraffic = interfaces.reduce((sum, iface) => sum + iface.rxRate + iface.txRate, 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Real-time router statistics and monitoring</p>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard
          title="CPU Usage"
          value={routerStatus.cpuLoad.toString()}
          unit="%"
          status={getStatus(routerStatus.cpuLoad)}
          icon="CPU"
        />
        <StatCard
          title="Memory"
          value={(routerStatus.memoryUsed / 1024 / 1024 / 1024).toFixed(1)}
          unit="GB"
          status={getStatus(memoryPercentage)}
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
          value={(totalTraffic / 1024 / 1024).toFixed(0)}
          unit="Mbps"
          status={totalTraffic > 100000000 ? 'warning' : 'good'}
          icon="NET"
        />
      </div>

      {/* Interfaces Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Network Interfaces</h2>
          <span className={styles.sectionBadge}>
            {interfaces.filter(i => i.status === 'up').length} Active
          </span>
        </div>
        <div className={styles.interfacesList}>
          {interfaces.map((iface) => (
            <InterfaceItem
              key={iface.id}
              name={iface.name}
              status={iface.status}
              rx={formatBytes(iface.rxBytes)}
              tx={formatBytes(iface.txBytes)}
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
