import React from 'react';
import {
  DashboardOutlined,
  CodeOutlined,
  RobotOutlined,
  GlobalOutlined,
  SafetyOutlined,
  ApiOutlined,
  LineChartOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { RouterInfo } from '../../molecules/RouterInfo/RouterInfo';
import { RouterInfo as RouterInfoType } from '../../../types/router';
import styles from './Sidebar.module.css';
import bardLogo from '../../../assets/bard-logo3.png';

export interface SidebarProps {
  router: RouterInfoType;
  activeNav: string;
  onNavigate: (nav: string) => void;
  onReboot: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', Icon: DashboardOutlined },
  { id: 'terminal', label: 'Terminal', Icon: CodeOutlined },
  { id: 'chat', label: 'AI Assistant', Icon: RobotOutlined },
  { id: 'network', label: 'Network', Icon: GlobalOutlined },
  { id: 'firewall', label: 'Firewall', Icon: SafetyOutlined },
  { id: 'dhcp', label: 'DHCP', Icon: ApiOutlined },
  { id: 'analytics', label: 'Analytics', Icon: LineChartOutlined },
  { id: 'settings', label: 'Settings', Icon: SettingOutlined },
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
        <img
          src={bardLogo}
          alt="MikroTik Dashboard"
          style={{
            width: '100%',
            height: 'auto',
            maxWidth: '320px',
            display: 'block',
            margin: '0 auto'
          }}
        />
      </div>

      <div className={styles.routerSection}>
        <h2 className={styles.sectionTitle}>Connected Router</h2>
        <RouterInfo router={router} />
      </div>

      <nav className={styles.navigation}>
        {navItems.map((item) => {
          const { Icon } = item;
          return (
            <button
              key={item.id}
              className={`${styles.navButton} ${activeNav === item.id ? styles.active : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={activeNav === item.id ? 'page' : undefined}
            >
              <Icon className={styles.navIcon} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
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
