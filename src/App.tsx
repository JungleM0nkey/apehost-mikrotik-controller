import React, { useState } from 'react';
import { Sidebar } from './components/organisms/Sidebar/Sidebar';
import { SettingsPage } from './pages/SettingsPage/SettingsPage';
import { RouterInfo } from './types/router';
import './styles/tokens.css';
import './styles/reset.css';
import styles from './App.module.css';

const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState('dashboard');

  const routerInfo: RouterInfo = {
    name: 'RB4011',
    ipAddress: '192.168.88.1',
    status: 'online',
    model: 'RB4011',
    osVersion: '7.11'
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
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <div className={styles.placeholder}>
            <h1>MikroTik Router Management Dashboard</h1>
            <p>Active Section: {activeNav}</p>
            <p style={{ marginTop: '16px', color: 'var(--color-text-secondary)' }}>
              Navigate to Settings to see the new configuration page
            </p>
          </div>
        );
    }
  };

  return (
    <div className={styles.app}>
      <Sidebar
        router={routerInfo}
        activeNav={activeNav}
        onNavigate={handleNavigate}
        onReboot={handleReboot}
      />

      <main className={styles.main}>
        <div className={styles.content}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
