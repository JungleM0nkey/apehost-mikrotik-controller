import React, { useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import { ExpandOutlined, CompressOutlined, MinusOutlined, CloseOutlined, CodeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTerminalManager } from '../../../contexts/TerminalManagerContext';
import { TerminalPanel } from '../TerminalPanel/TerminalPanel';
import type { Terminal } from '../../../types/terminal-manager';
import styles from './TerminalWindow.module.css';

export interface TerminalWindowProps {
  terminal: Terminal;
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({ terminal }) => {
  const {
    closeTerminal,
    minimizeTerminal,
    setActiveTerminal,
    updateTerminalPosition,
    updateTerminalSize,
    updateSessionId,
    resetTerminal,
  } = useTerminalManager();

  const [isMaximized, setIsMaximized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const initConnection = async () => {
      try {
        setIsConnecting(true);
        setConnectionError(null);

        await terminal.websocketConnection.connect();

        setIsConnecting(false);

        // Listen for session creation
        const cleanup = terminal.websocketConnection.onConnect(() => {
          const sessionId = terminal.websocketConnection.getSessionId();
          if (sessionId) {
            updateSessionId(terminal.id, sessionId);
          }
        });

        // Get initial session ID
        const sessionId = terminal.websocketConnection.getSessionId();
        if (sessionId) {
          updateSessionId(terminal.id, sessionId);
        }

        return cleanup;
      } catch (error) {
        console.error('[TerminalWindow] Connection failed:', error);
        setIsConnecting(false);
        setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      }
    };

    initConnection();

    // Cleanup on unmount
    return () => {
      // Don't disconnect - let the context handle cleanup
    };
  }, [terminal.id, terminal.websocketConnection, updateSessionId]);

  const handleMinimize = () => {
    minimizeTerminal(terminal.id);
  };

  const handleClose = () => {
    closeTerminal(terminal.id);
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const handleReset = () => {
    resetTerminal(terminal.id);
  };

  const handleFocus = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent deactivating when clicking on terminal
    if (!terminal.isActive) {
      setActiveTerminal(terminal.id);
    }
  };

  const handleDragStop = (_e: any, d: { x: number; y: number }) => {
    updateTerminalPosition(terminal.id, { x: d.x, y: d.y });
  };

  const handleResizeStop = (
    _e: any,
    _direction: any,
    ref: HTMLElement,
    _delta: any,
    position: { x: number; y: number }
  ) => {
    updateTerminalSize(terminal.id, {
      width: parseInt(ref.style.width),
      height: parseInt(ref.style.height),
    });
    updateTerminalPosition(terminal.id, position);
  };

  // Don't render if minimized
  if (terminal.isMinimized) {
    return null;
  }

  // Maximized mode
  if (isMaximized) {
    return (
      <div
        className={styles.maximized}
        style={{ zIndex: terminal.zIndex }}
        onClick={handleFocus}
      >
        <div className={styles.titleBar}>
          <div className={styles.titleContent}>
            <CodeOutlined className={styles.terminalIcon} />
            <span className={styles.title}>{terminal.name}</span>
          </div>
          <div className={styles.windowControls}>
            <button
              className={styles.controlButton}
              onClick={handleReset}
              title="Reset Terminal"
              aria-label="Reset terminal"
            >
              <ReloadOutlined />
            </button>
            <button
              className={styles.controlButton}
              onClick={handleMaximize}
              title="Restore"
              aria-label="Restore window"
            >
              <CompressOutlined />
            </button>
            <button
              className={styles.controlButton}
              onClick={handleMinimize}
              title="Minimize"
              aria-label="Minimize window"
            >
              <MinusOutlined />
            </button>
            <button
              className={styles.controlButton}
              onClick={handleClose}
              title="Close"
              aria-label="Close terminal"
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
        {connectionError ? (
          <div className={styles.connectionError}>
            <p>Failed to connect: {connectionError}</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : (
          <TerminalPanel
            websocket={terminal.websocketConnection}
            terminalId={terminal.id}
            hideHeader
          />
        )}
      </div>
    );
  }

  // Windowed mode
  return (
    <Rnd
      size={terminal.size}
      position={terminal.position}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      minWidth={500}
      minHeight={400}
      bounds="parent"
      dragHandleClassName={styles.dragHandle}
      className={styles.rndContainer}
      style={{ zIndex: terminal.zIndex }}
      enableResizing={true}
      disableDragging={false}
    >
      <div
        className={`${styles.window} ${terminal.isActive ? styles.active : ''}`}
        onClick={handleFocus}
      >
        <div className={`${styles.titleBar} ${styles.dragHandle}`}>
          <div className={styles.titleContent}>
            <CodeOutlined className={styles.terminalIcon} />
            <span className={styles.title}>{terminal.name}</span>
          </div>
          <div className={styles.windowControls}>
            <button
              className={styles.controlButton}
              onClick={handleReset}
              title="Reset Terminal"
              aria-label="Reset terminal"
            >
              <ReloadOutlined />
            </button>
            <button
              className={styles.controlButton}
              onClick={handleMinimize}
              title="Minimize"
              aria-label="Minimize window"
            >
              <MinusOutlined />
            </button>
            <button
              className={styles.controlButton}
              onClick={handleMaximize}
              title="Maximize"
              aria-label="Maximize window"
            >
              <ExpandOutlined />
            </button>
            <button
              className={styles.controlButton}
              onClick={handleClose}
              title="Close"
              aria-label="Close terminal"
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
        <div className={styles.content}>
          {connectionError ? (
            <div className={styles.connectionError}>
              <p>Failed to connect: {connectionError}</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : isConnecting ? (
            <div className={styles.connecting}>
              <div className={styles.spinner} />
              <p>Connecting to server...</p>
            </div>
          ) : (
            <TerminalPanel
              websocket={terminal.websocketConnection}
              terminalId={terminal.id}
              hideHeader
            />
          )}
        </div>
      </div>
    </Rnd>
  );
};
