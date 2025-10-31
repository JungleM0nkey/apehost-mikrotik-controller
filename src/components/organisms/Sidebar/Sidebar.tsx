import React, { useState } from 'react';
import { Menu } from 'antd';
import {
  DashboardOutlined,
  GlobalOutlined,
  SafetyOutlined,
  LockOutlined,
  SettingOutlined,
  ClusterOutlined,
  RobotOutlined,
  BookOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import { RouterInfo } from '../../molecules/RouterInfo/RouterInfo';
import { RouterInfo as RouterInfoType } from '../../../types/router';
import styles from './Sidebar.module.css';
import apehostLogo from '../../../assets/apehost-mikrotik-controller-no-bg.png';

export interface SidebarProps {
  router: RouterInfoType;
  activeNav: string;
  onNavigate: (nav: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  router,
  activeNav,
  onNavigate
}) => {
  const [openKeys, setOpenKeys] = useState<string[]>(activeNav === 'settings' ? ['settings'] : []);

  const handleMenuClick = (key: string) => {
    // If it's a settings sub-item, set hash and navigate to settings
    if (key.startsWith('settings-')) {
      const sectionId = key.replace('settings-', '');
      window.location.hash = sectionId;
      onNavigate('settings');
    } else {
      onNavigate(key);
    }
  };

  const handleSubMenuChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'network',
      icon: <GlobalOutlined />,
      label: 'Network',
    },
    {
      key: 'firewall',
      icon: <SafetyOutlined />,
      label: 'Firewall',
    },
    {
      key: 'wireguard',
      icon: <LockOutlined />,
      label: 'Wireguard VPN',
    },
    {
      key: 'analytics',
      icon: <ClusterOutlined />,
      label: 'Network Map',
    },
    {
      key: 'agent',
      icon: <RobotOutlined />,
      label: 'AI Agent',
    },
    {
      key: 'learning',
      icon: <ExperimentOutlined />,
      label: 'AI Learning',
    },
    {
      key: 'documentation',
      icon: <BookOutlined />,
      label: 'Documentation',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      children: [
        { key: 'settings-router-api', label: 'RouterOS API' },
        { key: 'settings-ai-assistant', label: 'AI Assistant' },
        { key: 'settings-display', label: 'Display' },
        { key: 'settings-terminal', label: 'Terminal' },
        { key: 'settings-security', label: 'Security' },
      ],
    },
  ];

  return (
    <aside className={styles.sidebar} role="navigation" aria-label="Main navigation">
      <div className={styles.logo}>
        <img
          src={apehostLogo}
          alt="ApeHost MikroTik Controller Dashboard"
          className={styles.logoImage}
        />
      </div>

      <div className={styles.routerSection}>
        <h2 className={styles.sectionTitle}>
          <ClusterOutlined className={styles.sectionIcon} />
          Connected Router
        </h2>
        <RouterInfo router={router} />
      </div>

      <nav className={styles.navigation}>
        <Menu
          mode="inline"
          selectedKeys={[activeNav]}
          openKeys={openKeys}
          onOpenChange={handleSubMenuChange}
          onClick={({ key }) => handleMenuClick(key)}
          items={menuItems}
          className={styles.menu}
          style={{
            background: 'transparent',
            border: 'none',
          }}
        />
      </nav>
    </aside>
  );
};
