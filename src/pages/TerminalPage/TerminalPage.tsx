import React from 'react';
import { TerminalPanel } from '../../components/organisms/TerminalPanel/TerminalPanel';
import styles from './TerminalPage.module.css';

export const TerminalPage: React.FC = () => {
  const handleCommand = (command: string) => {
    console.log('Command executed:', command);
    // This will be replaced with actual API call in Phase 2
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Terminal</h1>
        <p className={styles.subtitle}>Execute RouterOS commands directly</p>
      </div>

      <div className={styles.terminalContainer}>
        <TerminalPanel onCommand={handleCommand} />
      </div>
    </div>
  );
};
