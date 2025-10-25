import React from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { useTerminalManager } from '../../../contexts/TerminalManagerContext';
import { TerminalTab } from '../../molecules/TerminalTab/TerminalTab';
import styles from './TerminalTaskbar.module.css';

export const TerminalTaskbar: React.FC = () => {
  const {
    state,
    createTerminal,
    closeTerminal,
    renameTerminal,
    setActiveTerminal,
    duplicateTerminal,
  } = useTerminalManager();

  const terminals = Array.from(state.terminals.values());

  const handleNewTerminal = () => {
    createTerminal();
  };

  return (
    <div className={styles.taskbar} role="toolbar" aria-label="Terminal tabs">
      <div className={styles.tabsContainer}>
        {terminals.map((terminal) => (
          <TerminalTab
            key={terminal.id}
            terminal={terminal}
            onActivate={setActiveTerminal}
            onClose={closeTerminal}
            onRename={renameTerminal}
            onDuplicate={duplicateTerminal}
          />
        ))}
      </div>

      <button
        className={styles.newTerminalButton}
        onClick={handleNewTerminal}
        aria-label="Create new terminal"
        title="Create new terminal (Ctrl+Shift+T)"
      >
        <PlusOutlined />
      </button>
    </div>
  );
};
