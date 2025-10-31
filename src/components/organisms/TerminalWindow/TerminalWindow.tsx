import React, { useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import { ExpandOutlined, CompressOutlined, MinusOutlined, CloseOutlined, CodeOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { Modal, message } from 'antd';
import { useTerminalManager } from '../../../contexts/TerminalManagerContext';
import { useLLMStatus } from '../../../hooks/useLLMStatus';
import { TerminalPanel } from '../TerminalPanel/TerminalPanel';
import { AssistantPanel } from '../AssistantPanel/AssistantPanel';
import { clearConversation } from '../../../utils/conversationStorage';
import type { Terminal } from '../../../types/terminal-manager';
import type { TerminalTab } from '../../../types/terminal';
import styles from './TerminalWindow.module.css';

interface AIModelInfo {
  available: boolean;
  provider: string;
  model: string;
  context_window: number | string;
  features: {
    streaming: boolean;
    function_calling: boolean;
  };
  token_costs: {
    prompt_per_1m: number;
    completion_per_1m: number;
    note: string;
  };
}

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

  const { llmStatus } = useLLMStatus();

  const [isMaximized, setIsMaximized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [activeTab, setActiveTab] = useState<TerminalTab>('terminal');
  const [modelInfo, setModelInfo] = useState<AIModelInfo | null>(null);
  const [clearTrigger, setClearTrigger] = useState(0);

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

  // Fetch AI model information
  useEffect(() => {
    const fetchModelInfo = async () => {
      try {
        const response = await fetch('/api/service/ai-info');
        if (response.ok) {
          const data = await response.json();
          setModelInfo(data);
        }
      } catch (err) {
        console.error('[TerminalWindow] Failed to fetch AI model info:', err);
      }
    };

    if (llmStatus.configured) {
      fetchModelInfo();
    }
  }, [llmStatus.configured]);

  const handleMinimize = () => {
    setIsMinimizing(true);
    setTimeout(() => {
      minimizeTerminal(terminal.id);
      setIsMinimizing(false);
    }, 300); // Match animation duration
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      closeTerminal(terminal.id);
      setIsClosing(false);
    }, 150); // Match animation duration
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

  // Render tab content
  const renderTabContent = () => {
    if (connectionError) {
      return (
        <div className={styles.connectionError}>
          <p>Failed to connect: {connectionError}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      );
    }

    if (activeTab === 'terminal') {
      return (
        <TerminalPanel
          key={`${terminal.id}-${terminal.resetCount}`}
          websocket={terminal.websocketConnection}
          terminalId={terminal.id}
          hideHeader
        />
      );
    }

    if (activeTab === 'assistant') {
      return (
        <AssistantPanel
          key={`assistant-${clearTrigger}`}
          websocket={terminal.websocketConnection}
          terminalId={terminal.id}
          hideHeader
          onRunCommand={handleRunCommand}
        />
      );
    }

    return null;
  };

  const handleRunCommand = (command: string) => {
    // Send command to terminal
    const socket = terminal.websocketConnection.getSocket();
    if (socket) {
      socket.emit('terminal:input', {
        terminalId: terminal.id,
        data: command + '\n'
      });

      // Switch to terminal tab to show execution
      setActiveTab('terminal');
    }
  };

  const handleClearHistory = () => {
    Modal.confirm({
      title: 'Clear Conversation History',
      content: 'Are you sure you want to clear all messages? This action cannot be undone.',
      okText: 'Clear History',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        const socket = terminal.websocketConnection.getSocket();
        if (socket) {
          socket.emit('assistant:clearHistory', { conversationId: terminal.id });
          clearConversation(terminal.id);
          setClearTrigger(prev => prev + 1); // Force AssistantPanel to remount
          message.success('Conversation history cleared');
        }
      },
    });
  };

  // Maximized mode
  if (isMaximized) {
    return (
      <div
        className={`${styles.maximized} ${isClosing ? styles.closing : ''} ${isMinimizing ? styles.minimizing : ''}`}
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
        <div className={styles.tabBar}>
          <div className={styles.tabGroup}>
            <button
              className={`${styles.tab} ${activeTab === 'terminal' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('terminal')}
            >
              Terminal
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'assistant' ? styles.tabActive : ''} ${!llmStatus.configured ? styles.tabDisabled : ''}`}
              onClick={() => llmStatus.configured && setActiveTab('assistant')}
              disabled={!llmStatus.configured}
              title={!llmStatus.configured ? 'AI Assistant requires LLM configuration. Please configure in Settings.' : 'AI Assistant'}
            >
              <div className={styles.tabContent}>
                <span>AI Assistant</span>
                {/* {modelInfo && modelInfo.available && activeTab === 'assistant' && (
                  <span className={styles.tabModelInfo}>
                    {modelInfo.model} • {typeof modelInfo.context_window === 'number' ? `${modelInfo.context_window.toLocaleString()}` : modelInfo.context_window} context
                  </span>
                )} */}
              </div>
            </button>
          </div>
          {activeTab === 'assistant' && (
            <button
              className={styles.clearHistoryButton}
              onClick={handleClearHistory}
              title="Start a new conversation session"
              aria-label="Clear conversation history"
            >
              <DeleteOutlined />
              <span>New Session</span>
            </button>
          )}
        </div>
        {renderTabContent()}
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
        className={`${styles.window} ${terminal.isActive ? styles.active : ''} ${isClosing ? styles.closing : ''} ${isMinimizing ? styles.minimizing : ''}`}
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
        <div className={styles.tabBar}>
          <div className={styles.tabGroup}>
            <button
              className={`${styles.tab} ${activeTab === 'terminal' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('terminal')}
            >
              Terminal
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'assistant' ? styles.tabActive : ''} ${!llmStatus.configured ? styles.tabDisabled : ''}`}
              onClick={() => llmStatus.configured && setActiveTab('assistant')}
              disabled={!llmStatus.configured}
              title={!llmStatus.configured ? 'AI Assistant requires LLM configuration. Please configure in Settings.' : 'AI Assistant'}
            >
              <div className={styles.tabContent}>
                <span>AI Assistant</span>
                {modelInfo && modelInfo.available && activeTab === 'assistant' && (
                  <span className={styles.tabModelInfo}>
                    {modelInfo.model} • {typeof modelInfo.context_window === 'number' ? `${modelInfo.context_window.toLocaleString()}` : modelInfo.context_window} context
                  </span>
                )}
              </div>
            </button>
          </div>
          {activeTab === 'assistant' && (
            <button
              className={styles.clearHistoryButton}
              onClick={handleClearHistory}
              title="Start a new conversation session"
              aria-label="Clear conversation history"
            >
              <DeleteOutlined />
              <span>New Session</span>
            </button>
          )}
        </div>
        <div className={styles.content}>
          {isConnecting ? (
            <div className={styles.connecting}>
              <div className={styles.spinner} />
              <p>Connecting to server...</p>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>
    </Rnd>
  );
};
