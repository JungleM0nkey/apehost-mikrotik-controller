import React, { useState } from 'react';
import { Sidebar } from './components/organisms/Sidebar/Sidebar';
import { Header } from './components/organisms/Header/Header';
import { DashboardPage } from './pages/DashboardPage/DashboardPage';
import { TerminalPage } from './pages/TerminalPage/TerminalPage';
import { ChatPage } from './pages/ChatPage/ChatPage';
import { SettingsPage } from './pages/SettingsPage/SettingsPage';
import { useRouterInfo } from './hooks/useRouterInfo';
import './styles/tokens.css';
import './styles/reset.css';
import styles from './App.module.css';

const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState('dashboard');
  const { routerInfo, loading } = useRouterInfo();

  // Default router info while loading
  const defaultRouterInfo = {
    name: 'Loading...',
    ipAddress: '...',
    status: 'offline' as const,
    model: '...',
    osVersion: '...'
  };

  const handleNavigate = (nav: string) => {
    setActiveNav(nav);
  };

  const handleReboot = () => {
    if (window.confirm('Are you sure you want to reboot the router?')) {
      console.log('Rebooting router...');
      // Implement reboot logic
    }
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':
        return <DashboardPage />;
      case 'terminal':
        return <TerminalPage />;
      case 'chat':
        return <ChatPage />;
      case 'settings':
        return <SettingsPage />;
      case 'network':
      case 'firewall':
      case 'dhcp':
      case 'analytics':
        return (
          <div className={styles.placeholder}>
            <h1>{activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</h1>
            <p>This section is under construction</p>
            <p style={{ marginTop: '16px', color: 'var(--color-text-secondary)' }}>
              Implemented pages: Dashboard, Terminal, AI Assistant, Settings
            </p>
          </div>
        );
      default:
        return (
          <div className={styles.placeholder}>
            <h1>MikroTik Router Management Dashboard</h1>
            <p>Select a section from the navigation menu</p>
          </div>
        );
    }
  };

  return (
    <div className={styles.app}>
      <Sidebar
        router={routerInfo || defaultRouterInfo}
        activeNav={activeNav}
        onNavigate={handleNavigate}
        onReboot={handleReboot}
      />

      <main className={styles.main}>
        <Header currentPage={activeNav} />
        <div className={styles.content}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
