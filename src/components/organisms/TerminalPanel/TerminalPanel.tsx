import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Slider } from 'antd';
import {
  CopyOutlined,
  PushpinOutlined,
  SelectOutlined,
  ClearOutlined,
  FontSizeOutlined
} from '@ant-design/icons';
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
  const [contextMenu, setContextMenu] = useState<{x: number; y: number} | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const lineIdCounter = useRef<number>(0);
  const isInitialized = useRef<boolean>(false);

  // Generate unique line ID
  const generateLineId = (): string => {
    lineIdCounter.current += 1;
    return `${Date.now()}-${lineIdCounter.current}`;
  };

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
    // Prevent double initialization in React Strict Mode
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;

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
MikroTik RouterOS 7.20 (c) 1999-2025       https://www.mikrotik.com/

BARD Terminal v1.0.0
Developed by: Ilya Shevchenko

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
            id: generateLineId(),
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
            id: generateLineId(),
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
            id: generateLineId(),
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
            id: generateLineId(),
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
      isInitialized.current = false;
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
        id: generateLineId(),
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
        { id: generateLineId(), type: 'command', content: cmd, timestamp: new Date().toISOString() },
        helpLine
      ]);
      setCurrentCommand('');
      return;
    }

    // Validate RouterOS command format
    if (!cmd.startsWith('/')) {
      const errorLine: TerminalLine = {
        id: generateLineId(),
        type: 'error',
        content: `Error: RouterOS commands must start with /\nExample: /system resource print\nType /help for available commands`,
        timestamp: new Date().toISOString()
      };
      setLines(prev => [...prev,
        { id: generateLineId(), type: 'command', content: cmd, timestamp: new Date().toISOString() },
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
        id: generateLineId(),
        type: 'error',
        content: `Error: "${cmd}" is incomplete. Did you mean:\n${incompleteCmds[cmd]}\n\nType /help for more commands`,
        timestamp: new Date().toISOString()
      };
      setLines(prev => [...prev,
        { id: generateLineId(), type: 'command', content: cmd, timestamp: new Date().toISOString() },
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
      id: generateLineId(),
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
        id: generateLineId(),
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

  // Context menu handlers
  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();

    // Check if clipboard has content
    try {
      const text = await navigator.clipboard.readText();
      setCanPaste(text.length > 0);
    } catch (err) {
      // If we can't read clipboard (permissions), disable paste
      setCanPaste(false);
    }

    // Menu dimensions (approximate)
    const menuWidth = 220;
    const menuHeight = 180;

    // Viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Use clientX/clientY since we're rendering in a portal with position:fixed
    let x = e.clientX;
    let y = e.clientY;

    // Prevent overflow on right edge
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }

    // Prevent overflow on bottom edge
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    // Prevent overflow on left edge
    if (x < 10) {
      x = 10;
    }

    // Prevent overflow on top edge
    if (y < 10) {
      y = 10;
    }

    setContextMenu({ x, y });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleCopyAll = async () => {
    const allText = lines.map(line => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = line.content;
      return tempDiv.textContent || tempDiv.innerText || '';
    }).join('\n');

    try {
      await navigator.clipboard.writeText(allText);
    } catch (err) {
      console.error('Failed to copy:', err);
    } finally {
      closeContextMenu();
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setCurrentCommand(text);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to paste:', err);
    } finally {
      closeContextMenu();
    }
  };

  const handleSelectAll = () => {
    const selection = window.getSelection();
    const range = document.createRange();
    if (outputRef.current) {
      range.selectNodeContents(outputRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    closeContextMenu();
  };

  const handleClearTerminal = () => {
    setLines([]);
    closeContextMenu();
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => closeContextMenu();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };

    if (contextMenu) {
      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [contextMenu]);

  return (
    <div className={styles.container} onClick={handleTerminalClick}>
      {!hideHeader && (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>TRM</span>
            <span className={styles.headerTitle}>Terminal</span>
          </div>
          <div className={styles.headerCenter}>
            <FontSizeOutlined className={styles.fontSizeIcon} />
            <Slider
              min={10}
              max={20}
              value={fontSize}
              onChange={setFontSize}
              className={styles.fontSizeSlider}
              tooltip={{ formatter: (value) => `${value}px` }}
            />
          </div>
          <div className={styles.headerRight}>
            <span className={`${styles.statusDot} ${isConnected ? styles.statusConnected : styles.statusDisconnected}`} />
            <span className={styles.statusText}>
              {isExecuting ? 'Executing...' : isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      )}

      <div className={styles.terminal} style={{ fontSize: `${fontSize}px` }}>
        <div
          className={styles.output}
          ref={outputRef}
          onContextMenu={handleContextMenu}
        >
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="8" y="8" width="12" height="12" rx="2"></rect>
                      <path d="M16 8v-2a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
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

      {/* Context Menu - Rendered in portal to avoid transform issues */}
      {contextMenu && createPortal(
        <div
          className={styles.contextMenu}
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={styles.contextMenuItem} onClick={handleCopyAll}>
            <CopyOutlined className={styles.contextMenuIcon} />
            <span>Copy All</span>
            <span className={styles.contextMenuShortcut}>Ctrl+Shift+C</span>
          </button>
          <button
            className={`${styles.contextMenuItem} ${!canPaste ? styles.contextMenuItemDisabled : ''}`}
            onClick={handlePaste}
            disabled={!canPaste}
          >
            <PushpinOutlined className={styles.contextMenuIcon} />
            <span>Paste</span>
            <span className={styles.contextMenuShortcut}>Ctrl+V</span>
          </button>
          <div className={styles.contextMenuDivider} />
          <button className={styles.contextMenuItem} onClick={handleSelectAll}>
            <SelectOutlined className={styles.contextMenuIcon} />
            <span>Select All</span>
            <span className={styles.contextMenuShortcut}>Ctrl+A</span>
          </button>
          <button className={styles.contextMenuItem} onClick={handleClearTerminal}>
            <ClearOutlined className={styles.contextMenuIcon} />
            <span>Clear</span>
            <span className={styles.contextMenuShortcut}>Ctrl+L</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};
