import React, { useState, useRef, useEffect } from 'react';
import websocket from '../../../services/websocket';
import type { TerminalOutputEvent, TerminalErrorEvent, TerminalExecutingEvent } from '../../../services/websocket';
import { TerminalLine } from '../../../types/terminal';
import styles from './TerminalPanel.module.css';

export interface TerminalPanelProps {
  onCommand?: (command: string) => void;
  initialLines?: TerminalLine[];
  hideHeader?: boolean;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  onCommand,
  initialLines = [],
  hideHeader = false
}) => {
  const [lines, setLines] = useState<TerminalLine[]>(initialLines);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [copiedLineId, setCopiedLineId] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Common MikroTik commands for autocomplete
  const commonCommands = [
    '/system resource print',
    '/system identity print',
    '/system clock print',
    '/system reboot',
    '/ip address print',
    '/ip route print',
    '/ip firewall filter print',
    '/ip firewall nat print',
    '/interface print',
    '/interface ethernet print',
    '/interface wireless print',
    '/user print',
    '/log print',
    '/file print',
    '/routing bgp peer print',
    '/routing ospf instance print',
    '/tool ping',
    '/tool traceroute',
    '/quit',
    '/help',
    '/clear'
  ];

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Initialize WebSocket connection
  useEffect(() => {
    let cleanupFns: Array<() => void> = [];

    const initWebSocket = async () => {
      try {
        await websocket.connect();
        setIsConnected(true);

        // Add initial prompt
        if (lines.length === 0) {
          setLines([{
            id: '0',
            type: 'output',
            content: `<span class="bard-logo">
  MMM      MMM       KKK                          TTTTTTTTTTT      KKK
  MMMM    MMMM       KKK                          TTTTTTTTTTT      KKK
  MMM MMMM MMM  III  KKK  KKK  RRRRRR     OOOOOO      TTT     III  KKK  KKK
  MMM  MM  MMM  III  KKKKK     RRR  RRR  OOO  OOO     TTT     III  KKKKK
  MMM      MMM  III  KKK KKK   RRRRRR    OOO  OOO     TTT     III  KKK KKK
  MMM      MMM  III  KKK  KKK  RRR  RRR   OOOOOO      TTT     III  KKK  KKK
</span>
<span class="terminal-info">
MikroTik RouterOS v7.12 (STABLE)
Terminal Interface v1.0.0 - WebSocket Edition

Developed by: BARD Labs
Infrastructure: apehost.net
WebSocket: Connected & Ready

Quick Start:
  • Type /help to see available RouterOS commands
  • Use UP/DOWN arrows to navigate command history
  • Press TAB for command autocomplete
  • Type /clear to clear the terminal screen

Ready for commands. Happy routing!
</span>`,
            timestamp: new Date().toISOString()
          }]);
        }

        // Listen for command output
        const cleanupOutput = websocket.onOutput((data: TerminalOutputEvent) => {
          const responseLine: TerminalLine = {
            id: Date.now().toString(),
            type: 'output',
            content: data.output,
            timestamp: data.timestamp
          };
          setLines(prev => [...prev, responseLine]);
          setIsExecuting(false);
        });
        cleanupFns.push(cleanupOutput);

        // Listen for errors
        const cleanupError = websocket.onError((data: TerminalErrorEvent) => {
          const errorLine: TerminalLine = {
            id: Date.now().toString(),
            type: 'error',
            content: `Error: ${data.error}`,
            timestamp: data.timestamp
          };
          setLines(prev => [...prev, errorLine]);
          setIsExecuting(false);
        });
        cleanupFns.push(cleanupError);

        // Listen for command execution start
        const cleanupExecuting = websocket.onExecuting((data: TerminalExecutingEvent) => {
          console.log('[Terminal] Executing:', data.command);
        });
        cleanupFns.push(cleanupExecuting);

        // Listen for disconnection
        const cleanupDisconnect = websocket.onDisconnect((reason: string) => {
          setIsConnected(false);
          const disconnectLine: TerminalLine = {
            id: Date.now().toString(),
            type: 'error',
            content: `Disconnected: ${reason}`,
            timestamp: new Date().toISOString()
          };
          setLines(prev => [...prev, disconnectLine]);
        });
        cleanupFns.push(cleanupDisconnect);

        // Listen for reconnection
        const cleanupConnect = websocket.onConnect(() => {
          setIsConnected(true);
          const reconnectLine: TerminalLine = {
            id: Date.now().toString(),
            type: 'output',
            content: 'Reconnected to server',
            timestamp: new Date().toISOString()
          };
          setLines(prev => [...prev, reconnectLine]);
        });
        cleanupFns.push(cleanupConnect);

      } catch (error) {
        console.error('[Terminal] WebSocket connection failed:', error);
        setIsConnected(false);
        setLines([{
          id: '0',
          type: 'error',
          content: 'Failed to connect to WebSocket server',
          timestamp: new Date().toISOString()
        }]);
      }
    };

    initWebSocket();

    // Cleanup on unmount - only cleanup event listeners, keep connection alive
    return () => {
      cleanupFns.forEach(fn => fn());
      // Don't disconnect - websocket is a singleton that persists across component lifecycle
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentCommand.trim() || isExecuting) return;

    const cmd = currentCommand.trim();
    const cmdLower = cmd.toLowerCase();

    // Handle local commands
    if (cmdLower === '/clear' || cmdLower === 'clear') {
      setLines([]);
      setCurrentCommand('');
      return;
    }

    // Handle /help command
    if (cmdLower === '/help' || cmdLower === 'help') {
      const helpLine: TerminalLine = {
        id: Date.now().toString(),
        type: 'output',
        content: `MikroTik RouterOS Terminal Commands:

Built-in Commands:
  /help, help           Show this help message
  /clear, clear         Clear terminal screen

RouterOS Commands (must start with /):
  /system resource print              Show system resources
  /interface print                    List all interfaces
  /ip address print                   Show IP addresses
  /ip route print                     Show routing table
  /user print                         List users
  /log print                          Show system logs

Examples:
  /system identity print
  /interface ethernet print
  /ip firewall filter print

Note: All RouterOS commands must start with a forward slash (/)`,
        timestamp: new Date().toISOString()
      };
      setLines(prev => [...prev,
        { id: Date.now().toString(), type: 'command', content: cmd, timestamp: new Date().toISOString() },
        helpLine
      ]);
      setCurrentCommand('');
      return;
    }

    // Validate RouterOS command format
    if (!cmd.startsWith('/')) {
      const errorLine: TerminalLine = {
        id: Date.now().toString(),
        type: 'error',
        content: `Error: RouterOS commands must start with /\nExample: /system resource print\nType /help for available commands`,
        timestamp: new Date().toISOString()
      };
      setLines(prev => [...prev,
        { id: Date.now().toString(), type: 'command', content: cmd, timestamp: new Date().toISOString() },
        errorLine
      ]);
      setCurrentCommand('');
      return;
    }

    // Provide suggestions for incomplete commands
    const incompleteCmds: { [key: string]: string } = {
      '/ip': '/ip address print | /ip route print | /ip firewall filter print',
      '/interface': '/interface print | /interface ethernet print',
      '/system': '/system resource print | /system identity print | /system clock print',
      '/user': '/user print',
      '/log': '/log print',
      '/file': '/file print',
      '/routing': '/routing bgp peer print | /routing ospf instance print'
    };

    if (incompleteCmds[cmd]) {
      const suggestionLine: TerminalLine = {
        id: Date.now().toString(),
        type: 'error',
        content: `Error: "${cmd}" is incomplete. Did you mean:\n${incompleteCmds[cmd]}\n\nType /help for more commands`,
        timestamp: new Date().toISOString()
      };
      setLines(prev => [...prev,
        { id: Date.now().toString(), type: 'command', content: cmd, timestamp: new Date().toISOString() },
        suggestionLine
      ]);
      setCurrentCommand('');
      return;
    }

    // Add command to history
    const newHistory = [...commandHistory, cmd];
    setCommandHistory(newHistory);
    setHistoryIndex(-1);

    // Add command line to terminal
    const commandLine: TerminalLine = {
      id: Date.now().toString(),
      type: 'command',
      content: cmd,
      timestamp: new Date().toISOString()
    };

    setLines(prev => [...prev, commandLine]);
    setCurrentCommand('');
    setIsExecuting(true);

    try {
      // Execute command via WebSocket (now async with connection waiting)
      await websocket.executeCommand(cmd);

      // Callback for external handling
      if (onCommand) {
        onCommand(cmd);
      }
    } catch (error) {
      const errorLine: TerminalLine = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: error instanceof Error ? error.message : 'Command execution failed',
        timestamp: new Date().toISOString()
      };

      setLines(prev => [...prev, errorLine]);
      setIsExecuting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentCommand(value);

    // Update autocomplete suggestions
    if (value.length > 0) {
      const filtered = commonCommands.filter(cmd =>
        cmd.toLowerCase().startsWith(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
      setSelectedSuggestion(-1);
    } else {
      setSuggestions([]);
      setSelectedSuggestion(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab - prevent browser capture and autocomplete if suggestions available
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const selected = selectedSuggestion >= 0 ? selectedSuggestion : 0;
        setCurrentCommand(suggestions[selected]);
        setSuggestions([]);
        setSelectedSuggestion(-1);
      }
      return;
    }

    // Arrow up/down - navigate suggestions or command history
    if (e.key === 'ArrowUp') {
      e.preventDefault();

      // Navigate suggestions if visible
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev =>
          prev <= 0 ? suggestions.length - 1 : prev - 1
        );
        return;
      }

      // Navigate command history
      if (commandHistory.length === 0) return;
      const newIndex = historyIndex === -1
        ? commandHistory.length - 1
        : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setCurrentCommand(commandHistory[newIndex]);
      setSuggestions([]);
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();

      // Navigate suggestions if visible
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev =>
          prev >= suggestions.length - 1 ? 0 : prev + 1
        );
        return;
      }

      // Navigate command history
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setCurrentCommand('');
      } else {
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
      setSuggestions([]);
    }

    // Escape - close suggestions
    if (e.key === 'Escape') {
      setSuggestions([]);
      setSelectedSuggestion(-1);
    }
  };

  const handleTerminalClick = () => {
    // Don't focus input if user is selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    inputRef.current?.focus();
  };

  const handleCopyLine = async (lineId: string, content: string, event: React.MouseEvent) => {
    event.stopPropagation();

    // Strip HTML tags and get clean text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    try {
      await navigator.clipboard.writeText(textContent);
      setCopiedLineId(lineId);
      setTimeout(() => setCopiedLineId(null), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={styles.container} onClick={handleTerminalClick}>
      {!hideHeader && (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>TRM</span>
            <span className={styles.headerTitle}>Terminal</span>
          </div>
          <div className={styles.headerRight}>
            <span className={`${styles.statusDot} ${isConnected ? styles.statusConnected : styles.statusDisconnected}`} />
            <span className={styles.statusText}>
              {isExecuting ? 'Executing...' : isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      )}

      <div className={styles.terminal}>
        <div className={styles.output}>
          {lines.map((line) => (
            <div
              key={line.id}
              className={`${styles.line} ${styles[line.type]} ${styles.copyableLine} ${
                hoveredLineId === line.id ? styles.lineHovered : ''
              } ${copiedLineId === line.id ? styles.lineCopied : ''}`}
              onMouseEnter={() => setHoveredLineId(line.id)}
              onMouseLeave={() => setHoveredLineId(null)}
            >
              {line.type === 'command' && (
                <span className={styles.prompt}>[admin@MikroTik] &gt; </span>
              )}
              <span
                className={styles.content}
                dangerouslySetInnerHTML={{ __html: line.content }}
              />
              {hoveredLineId === line.id && (
                <button
                  className={styles.copyButton}
                  onClick={(e) => handleCopyLine(line.id, line.content, e)}
                  title="Copy line"
                  aria-label="Copy line to clipboard"
                >
                  {copiedLineId === line.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
              )}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>

        <div className={styles.inputContainer}>
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <span className={styles.prompt}>[admin@MikroTik] &gt; </span>
            <input
              ref={inputRef}
              type="text"
              value={currentCommand}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className={styles.input}
              placeholder="Enter command..."
              spellCheck={false}
              autoComplete="off"
              autoFocus
            disabled={isExecuting}
          />
        </form>

        {/* Autocomplete suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className={styles.autocomplete}>
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`${styles.suggestion} ${index === selectedSuggestion ? styles.selected : ''}`}
                onClick={() => {
                  setCurrentCommand(suggestion);
                  setSuggestions([]);
                  setSelectedSuggestion(-1);
                  inputRef.current?.focus();
                }}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerHint}>
          <kbd>UP</kbd> <kbd>DN</kbd> Navigate • <kbd>TAB</kbd> Autocomplete
        </div>
        <div className={styles.footerHint}>
          Type <code>/help</code> for commands
        </div>
      </div>
    </div>
  );
};
