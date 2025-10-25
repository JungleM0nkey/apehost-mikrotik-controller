import React from 'react';
import { ResizableTerminal } from '../../components/organisms/ResizableTerminal/ResizableTerminal';
import styles from './TerminalPage.module.css';

export const TerminalPage: React.FC = () => {
  const handleCommand = (command: string) => {
    console.log('Command executed:', command);
  };

  return (
    <div className={styles.container}>
      <ResizableTerminal onCommand={handleCommand} />
    </div>
  );
};
