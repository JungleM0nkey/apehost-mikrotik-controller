import React, { useState } from 'react';
import { Sidebar } from './components/organisms/Sidebar/Sidebar';
import { Header } from './components/organisms/Header/Header';
import { DashboardPage } from './pages/DashboardPage/DashboardPage';
import { TerminalPage } from './pages/TerminalPage/TerminalPage';
import { ChatPage } from './pages/ChatPage/ChatPage';
import { SettingsPage } from './pages/SettingsPage/SettingsPage';
import { NetworkPage } from './pages/NetworkPage/NetworkPage';
import { useRouterInfo } from './hooks/useRouterInfo';
import './styles/tokens.css';
import './styles/reset.css';
import styles from './App.module.css';

const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState('dashboard');
  const { routerInfo } = useRouterInfo();

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

  const handleExportConfig = async () => {
    try {
      const response = await fetch('/api/router/export');
      if (!response.ok) {
        throw new Error('Failed to export configuration');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `router-config-${new Date().toISOString().split('T')[0]}.rsc`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export configuration:', error);
      alert('Failed to export router configuration. Please try again.');
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
        return <NetworkPage />;
      case 'firewall':
      case 'dhcp':
      case 'analytics':
        return (
          <div className={styles.placeholder}>
            <h1>{activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</h1>
            <p>This section is under construction</p>
            <p style={{ marginTop: '16px', color: 'var(--color-text-secondary)' }}>
              Implemented pages: Dashboard, Terminal, AI Assistant, Settings, Network
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
        onExportConfig={handleExportConfig}
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
