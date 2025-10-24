import React, { useState, useRef, useEffect } from 'react';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentCommand.trim()) return;

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

    // Generate mock response
    const response = generateMockResponse(currentCommand);
    const responseLine: TerminalLine = {
      id: (Date.now() + 1).toString(),
      type: 'output',
      content: response,
      timestamp: new Date().toISOString()
    };

    setLines([...lines, commandLine, responseLine]);
    setCurrentCommand('');

    // Callback for external handling
    if (onCommand) {
      onCommand(currentCommand);
    }
  };

  const generateMockResponse = (command: string): string => {
    const cmd = command.trim().toLowerCase();
    
    // Mock responses for common MikroTik commands
    if (cmd.startsWith('/system resource print')) {
      return `uptime: 15d7h23m45s
version: 7.11 (stable)
cpu-load: 23%
free-memory: 1200MiB
total-memory: 2048MiB`;
    }
    
    if (cmd.startsWith('/interface print')) {
      return `Flags: X - disabled, R - running
 #   NAME            TYPE       ACTUAL-MTU
 0 R ether1-gateway  ether      1500
 1 R ether2-local    ether      1500
 2   ether3          ether      1500
 3 R wlan1           wlan       1500`;
    }
    
    if (cmd.startsWith('/ip address print')) {
      return ` #   ADDRESS         NETWORK       INTERFACE
 0   192.168.88.1/24 192.168.88.0  ether2-local
 1   10.0.0.1/24     10.0.0.0      ether1-gateway`;
    }
    
    if (cmd === '/help' || cmd === 'help') {
      return `Available commands:
  /system resource print  - Show system resources
  /interface print        - Show network interfaces  
  /ip address print       - Show IP addresses
  /clear                  - Clear terminal
  /help                   - Show this help`;
    }
    
    if (cmd === '/clear' || cmd === 'clear') {
      setLines([]);
      return '';
    }
    
    // Default response for unknown commands
    return `bad command name ${command.split(' ')[0]} (line 1 column 1)`;
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
          <span className={styles.headerIcon}>💻</span>
          <span className={styles.headerTitle}>Terminal</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>Connected</span>
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
          />
        </form>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerHint}>
          <kbd>↑</kbd> <kbd>↓</kbd> Navigate history
        </div>
        <div className={styles.footerHint}>
          Type <code>/help</code> for commands
        </div>
      </div>
    </div>
  );
};
