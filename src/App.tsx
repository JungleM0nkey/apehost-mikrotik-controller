import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/organisms/Sidebar/Sidebar';
import { Header } from './components/organisms/Header/Header';
import { DashboardPage } from './pages/DashboardPage/DashboardPage';
import { TerminalPage } from './pages/TerminalPage/TerminalPage';
import { ChatPage } from './pages/ChatPage/ChatPage';
import { SettingsPage } from './pages/SettingsPage/SettingsPage';
import { NetworkPage } from './pages/NetworkPage/NetworkPage';
import { FirewallPage } from './pages/FirewallPage/FirewallPage';
import { WireguardPage } from './pages/WireguardPage/WireguardPage';
import { NetworkMapPage } from './pages/NetworkMapPage/NetworkMapPage';
import { AgentPage } from './pages/AgentPage/AgentPage';
import { DocumentationPage } from './pages/DocumentationPage/DocumentationPage';
import { LearningDashboardPage } from './pages/LearningDashboardPage/LearningDashboardPage';
import { SetupWizardPage } from './pages/SetupWizardPage/SetupWizardPage';
import { TerminalManagerProvider, useTerminalManager } from './contexts/TerminalManagerContext';
import { TerminalTaskbar } from './components/organisms/TerminalTaskbar/TerminalTaskbar';
import { TerminalWindow } from './components/organisms/TerminalWindow/TerminalWindow';
import { useTerminalKeyboardShortcuts } from './hooks/useTerminalKeyboardShortcuts';
import { useRouterInfo } from './hooks/useRouterInfo';
import { Spin } from 'antd';
import './styles/tokens.css';
import './styles/reset.css';
import styles from './App.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AppContent: React.FC = () => {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const { routerInfo } = useRouterInfo();
  const { state, deactivateAllTerminals } = useTerminalManager();

  // Enable keyboard shortcuts
  useTerminalKeyboardShortcuts();

  // Check if setup is required on mount
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/setup/status`);
        const data = await response.json();
        setSetupRequired(data.needsSetup);
      } catch (error) {
        console.error('Failed to check setup status:', error);
        setSetupRequired(false);
      } finally {
        setCheckingSetup(false);
      }
    };

    checkSetupStatus();
  }, []);

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
        return <FirewallPage />;
      case 'wireguard':
        return <WireguardPage />;
      case 'analytics':
        return <NetworkMapPage />;
      case 'agent':
        return <AgentPage />;
      case 'documentation':
        return <DocumentationPage />;
      case 'learning':
        return <LearningDashboardPage />;
      default:
        return (
          <div className={styles.placeholder}>
            <h1>MikroTik Router Management Dashboard</h1>
            <p>Select a section from the navigation menu</p>
          </div>
        );
    }
  };

  // Get terminals array
  const terminals = Array.from(state.terminals.values());

  // Handle clicking on main content to deactivate terminals
  const handleMainClick = () => {
    deactivateAllTerminals();
  };

  // Show loading spinner while checking setup status
  if (checkingSetup) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
        <p>Checking configuration...</p>
      </div>
    );
  }

  // Show setup wizard if setup is required
  if (setupRequired) {
    return <SetupWizardPage />;
  }

  return (
    <div className={styles.app}>
      <Sidebar
        router={routerInfo || defaultRouterInfo}
        activeNav={activeNav}
        onNavigate={handleNavigate}
      />

      <main className={styles.main} onClick={handleMainClick}>
        <Header currentPage={activeNav} />
        <div className={styles.content}>
          {renderContent()}
        </div>
      </main>

      {/* Render terminal windows */}
      {terminals.map((terminal) => (
        <TerminalWindow key={terminal.id} terminal={terminal} />
      ))}

      {/* Terminal taskbar (always visible at bottom) */}
      <TerminalTaskbar />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <TerminalManagerProvider>
      <AppContent />
    </TerminalManagerProvider>
  );
};

export default App;
