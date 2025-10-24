import React from 'react';
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

export const DashboardPage: React.FC = () => {
  // Mock data - will be replaced with real data from API
  const stats = {
    cpu: { value: '23', unit: '%', status: 'good' as const },
    memory: { value: '1.2', unit: 'GB', status: 'good' as const },
    uptime: { value: '15d 7h', status: 'good' as const },
    traffic: { value: '125', unit: 'Mbps', status: 'warning' as const }
  };

  const interfaces = [
    { name: 'ether1-gateway', status: 'up' as const, rx: '1.2 GB', tx: '856 MB' },
    { name: 'ether2-local', status: 'up' as const, rx: '2.5 GB', tx: '1.1 GB' },
    { name: 'ether3', status: 'down' as const, rx: '0 B', tx: '0 B' },
    { name: 'wlan1', status: 'up' as const, rx: '125 MB', tx: '89 MB' }
  ];

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
          value={stats.cpu.value}
          unit={stats.cpu.unit}
          status={stats.cpu.status}
          icon="⚡"
        />
        <StatCard
          title="Memory"
          value={stats.memory.value}
          unit={stats.memory.unit}
          status={stats.memory.status}
          icon="💾"
        />
        <StatCard
          title="Uptime"
          value={stats.uptime.value}
          status={stats.uptime.status}
          icon="⏱️"
        />
        <StatCard
          title="Traffic"
          value={stats.traffic.value}
          unit={stats.traffic.unit}
          status={stats.traffic.status}
          icon="📊"
        />
      </div>

      {/* Interfaces Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Network Interfaces</h2>
          <span className={styles.sectionBadge}>{interfaces.filter(i => i.status === 'up').length} Active</span>
        </div>
        <div className={styles.interfacesList}>
          {interfaces.map((iface) => (
            <InterfaceItem key={iface.name} {...iface} />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.quickActions}>
          <button className={styles.actionButton}>
            <span className={styles.actionIcon}>🔄</span>
            <span>Refresh Stats</span>
          </button>
          <button className={styles.actionButton}>
            <span className={styles.actionIcon}>📋</span>
            <span>View Logs</span>
          </button>
          <button className={styles.actionButton}>
            <span className={styles.actionIcon}>💾</span>
            <span>Backup Config</span>
          </button>
          <button className={styles.actionButton}>
            <span className={styles.actionIcon}>🔍</span>
            <span>Run Diagnostics</span>
          </button>
        </div>
      </div>
    </div>
  );
};
