import React from 'react';
import { RouterInfo } from '../../molecules/RouterInfo/RouterInfo';
import { RouterInfo as RouterInfoType } from '../../../types/router';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  router: RouterInfoType;
  activeNav: string;
  onNavigate: (nav: string) => void;
  onReboot: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'terminal', label: 'Terminal', icon: '💻' },
  { id: 'network', label: 'Network', icon: '🌐' },
  { id: 'firewall', label: 'Firewall', icon: '🛡️' },
  { id: 'dhcp', label: 'DHCP', icon: '📡' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  router,
  activeNav,
  onNavigate,
  onReboot
}) => {
  return (
    <aside className={styles.sidebar} role="navigation" aria-label="Main navigation">
      <div className={styles.logo}>
        <h1 style={{ 
          color: 'var(--color-accent-primary)', 
          fontSize: '20px', 
          fontWeight: 'bold',
          margin: 0,
          textAlign: 'center'
        }}>
          MikroTik Dashboard
        </h1>
      </div>

      <div className={styles.routerSection}>
        <h2 className={styles.sectionTitle}>Connected Router</h2>
        <RouterInfo router={router} />
      </div>

      <nav className={styles.navigation}>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.navButton} ${activeNav === item.id ? styles.active : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activeNav === item.id ? 'page' : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.footer}>
        <button
          className={styles.rebootButton}
          onClick={onReboot}
          aria-label="Reboot router"
        >
          Reboot Router
        </button>
      </div>
    </aside>
  );
};
