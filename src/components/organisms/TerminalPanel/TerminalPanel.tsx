import React, { useState, useRef, useEffect } from 'react';
import api from '../../../services/api';
import { TerminalLine } from '../../../types/terminal';
import styles from './TerminalPanel.module.css';

export interface TerminalPanelProps {
  onCommand?: (command: string) => void;
  initialLines?: TerminalLine[];
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  onCommand,
  initialLines = []
}) => {
  const [lines, setLines] = useState<TerminalLine[]>(initialLines);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Add initial prompt line
  useEffect(() => {
    if (lines.length === 0) {
      setLines([{
        id: '0',
        type: 'output',
        content: 'MikroTik RouterOS Terminal - Connected to 192.168.88.1',
        timestamp: new Date().toISOString()
      },
      {
        id: '1',
        type: 'output',
        content: 'Type /help for available commands',
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentCommand.trim() || isExecuting) return;

    // Handle local commands
    if (currentCommand.trim().toLowerCase() === '/clear' || currentCommand.trim().toLowerCase() === 'clear') {
      setLines([]);
      setCurrentCommand('');
      return;
    }

    // Add command to history
    const newHistory = [...commandHistory, currentCommand];
    setCommandHistory(newHistory);
    setHistoryIndex(-1);

    // Add command line to terminal
    const commandLine: TerminalLine = {
      id: Date.now().toString(),
      type: 'command',
      content: currentCommand,
      timestamp: new Date().toISOString()
    };

    setLines(prev => [...prev, commandLine]);
    setCurrentCommand('');
    setIsExecuting(true);

    try {
      // Call API to execute command
      const response = await api.executeCommand(currentCommand);
      
      const responseLine: TerminalLine = {
        id: (Date.now() + 1).toString(),
        type: 'output',
        content: response.output,
        timestamp: response.timestamp
      };

      setLines(prev => [...prev, responseLine]);

      // Callback for external handling
      if (onCommand) {
        onCommand(currentCommand);
      }
    } catch (error) {
      const errorLine: TerminalLine = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: error instanceof Error ? error.message : 'Command execution failed',
        timestamp: new Date().toISOString()
      };

      setLines(prev => [...prev, errorLine]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Arrow up - previous command
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      
      const newIndex = historyIndex === -1 
        ? commandHistory.length - 1 
        : Math.max(0, historyIndex - 1);
      
      setHistoryIndex(newIndex);
      setCurrentCommand(commandHistory[newIndex]);
    }
    
    // Arrow down - next command
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      
      const newIndex = historyIndex + 1;
      
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setCurrentCommand('');
      } else {
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    }
  };

  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className={styles.container} onClick={handleTerminalClick}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>TRM</span>
          <span className={styles.headerTitle}>Terminal</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>
            {isExecuting ? 'Executing...' : 'Connected'}
          </span>
        </div>
      </div>

      <div className={styles.terminal}>
        <div className={styles.output}>
          {lines.map((line) => (
            <div 
              key={line.id} 
              className={`${styles.line} ${styles[line.type]}`}
            >
              {line.type === 'command' && (
                <span className={styles.prompt}>[admin@MikroTik] &gt; </span>
              )}
              <span className={styles.content}>{line.content}</span>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>

        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <span className={styles.prompt}>[admin@MikroTik] &gt; </span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.input}
            placeholder="Enter command..."
            spellCheck={false}
            autoComplete="off"
            autoFocus
            disabled={isExecuting}
          />
        </form>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerHint}>
          <kbd>UP</kbd> <kbd>DN</kbd> Navigate history
        </div>
        <div className={styles.footerHint}>
          Type <code>/help</code> for commands
        </div>
      </div>
    </div>
  );
};
