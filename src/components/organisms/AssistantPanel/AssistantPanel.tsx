import React, { useState, useEffect, useRef } from 'react';
import { message, Button, Modal } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { MessageBubble } from '../../molecules/MessageBubble/MessageBubble';
import { EnhancedInput } from '../../molecules/EnhancedInput/EnhancedInput';
import { SessionInfoPanel, type ToolDefinition, type AIModelInfo } from '../../molecules/SessionInfoPanel/SessionInfoPanel';
import type { WebSocketService } from '../../../services/websocket';
import type { AssistantMessage, TokenUsage } from '../../../types/assistant';
import { defaultUISettings } from '../../../types/settings';
import {
  saveConversation,
  loadConversation,
  clearConversation,
  type ConversationMetadata,
} from '../../../utils/conversationStorage';
import styles from './AssistantPanel.module.css';

export interface AssistantPanelProps {
  websocket: WebSocketService;
  terminalId: string;
  hideHeader?: boolean;
  onRunCommand?: (command: string) => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  websocket,
  terminalId,
  hideHeader,
  onRunCommand,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [liveTokenCount, setLiveTokenCount] = useState(0);
  const [modelInfo, setModelInfo] = useState<AIModelInfo | null>(null);
  const [pricingInfo, setPricingInfo] = useState<{ prompt_per_1m: number; completion_per_1m: number } | null>(null);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyPosition, setHistoryPosition] = useState(-1);
  const [metadata, setMetadata] = useState<ConversationMetadata>({
    tools_called: [],
    commands_executed: [],
    session_start: Date.now(),
    total_tool_calls: 0,
    total_commands: 0,
  });
  const [showSessionInfo, setShowSessionInfo] = useState(true);
  const [availableTools, setAvailableTools] = useState<ToolDefinition[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [sidePanelSections, setSidePanelSections] = useState(
    defaultUISettings.aiAssistant.sidePanelSections
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationId = terminalId; // Use terminal ID as conversation ID

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load conversation history and metadata on mount
  useEffect(() => {
    const loaded = loadConversation(conversationId);
    if (loaded.messages.length > 0) {
      console.log('[AssistantPanel] Loaded', loaded.messages.length, 'messages from storage');
      setMessages(loaded.messages);
    }
    if (loaded.metadata) {
      console.log('[AssistantPanel] Loaded metadata from storage');
      setMetadata(loaded.metadata);
    }
  }, [conversationId]);

  // Save conversation history and metadata whenever messages or metadata change
  useEffect(() => {
    if (messages.length > 0) {
      saveConversation(conversationId, messages, metadata);
    }
  }, [messages, metadata, conversationId]);

  // Fetch AI model information
  useEffect(() => {
    const fetchModelInfo = async () => {
      try {
        const response = await fetch('/api/service/ai-info');
        if (response.ok) {
          const data = await response.json();
          console.log('[AssistantPanel] Model info received:', data);
          setModelInfo(data);

          // Extract pricing information for cost calculation
          if (data.token_costs) {
            setPricingInfo({
              prompt_per_1m: data.token_costs.prompt_per_1m,
              completion_per_1m: data.token_costs.completion_per_1m
            });
            console.log('[AssistantPanel] Pricing info:', {
              prompt: data.token_costs.prompt_per_1m,
              completion: data.token_costs.completion_per_1m
            });
          }
        } else {
          console.error('[AssistantPanel] Failed to fetch model info:', response.status, response.statusText);
        }
      } catch (err) {
        console.error('[AssistantPanel] Error fetching AI model info:', err);
      }
    };

    fetchModelInfo();
  }, []);

  // Load side panel visibility settings from localStorage
  useEffect(() => {
    const loadSidePanelSettings = () => {
      try {
        const stored = localStorage.getItem('uiSettings');
        if (stored) {
          const settings = JSON.parse(stored);
          if (settings.aiAssistant?.sidePanelSections) {
            setSidePanelSections(settings.aiAssistant.sidePanelSections);
          }
        }
      } catch (err) {
        console.error('[AssistantPanel] Error loading side panel settings:', err);
      }
    };

    loadSidePanelSettings();

    // Listen for storage changes (from settings page)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'uiSettings') {
        loadSidePanelSettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Fetch available tools
  useEffect(() => {
    const fetchTools = async () => {
      setIsLoadingTools(true);
      try {
        const response = await fetch('/api/service/mcp-tools');
        if (response.ok) {
          const data = await response.json();
          console.log('[AssistantPanel] Tools received:', data);
          setAvailableTools(data.tools || []);
        } else {
          console.error('[AssistantPanel] Failed to fetch tools:', response.status, response.statusText);
        }
      } catch (err) {
        console.error('[AssistantPanel] Error fetching tools:', err);
      } finally {
        setIsLoadingTools(false);
      }
    };

    fetchTools();
  }, []);

  // WebSocket event listeners
  useEffect(() => {
    const socket = websocket.getSocket();
    if (!socket) return;

    // Handle streaming chunks
    const handleStream = (data: { chunk: string; conversationId: string; messageId: string }) => {
      if (data.conversationId !== conversationId) return;

      setIsStreaming(true);
      setError(null);

      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];

        // If this is a new streaming message or continuing existing one
        if (!lastMessage || lastMessage.role === 'user' || !lastMessage.isStreaming) {
          // Create new assistant message
          return [
            ...prev,
            {
              id: data.messageId,
              role: 'assistant',
              content: data.chunk,
              timestamp: new Date(),
              isStreaming: true,
            },
          ];
        } else {
          // Append to existing streaming message
          return prev.map((msg, idx) =>
            idx === prev.length - 1
              ? { ...msg, content: msg.content + data.chunk }
              : msg
          );
        }
      });
    };

    // Handle completion
    const handleComplete = (data: {
      conversationId: string;
      messageId: string;
      fullMessage: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }) => {
      if (data.conversationId !== conversationId) return;

      setIsStreaming(false);
      setIsTyping(false);

      // Calculate cost if usage data and pricing available
      let usageWithCost: TokenUsage | undefined;
      if (data.usage && pricingInfo) {
        const promptCost = (data.usage.promptTokens / 1_000_000) * pricingInfo.prompt_per_1m;
        const completionCost = (data.usage.completionTokens / 1_000_000) * pricingInfo.completion_per_1m;
        const totalCost = promptCost + completionCost;

        usageWithCost = {
          ...data.usage,
          cost: {
            prompt: promptCost,
            completion: completionCost,
            total: totalCost
          }
        };

        console.log('[AssistantPanel] Token usage:', {
          tokens: data.usage,
          cost: usageWithCost.cost
        });
      } else if (data.usage) {
        // Usage data available but no pricing
        usageWithCost = data.usage;
      }

      // Mark message as complete with usage
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? {
                ...msg,
                isStreaming: false,
                usage: usageWithCost
              }
            : msg
        )
      );
    };

    // Handle errors
    const handleError = (data: { error: string; conversationId: string; code?: string; canRetry?: boolean }) => {
      if (data.conversationId !== conversationId) return;

      setIsStreaming(false);
      setIsTyping(false);
      setError(data.error);

      // Add error message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          error: data.error,
        },
      ]);
    };

    // Handle typing indicator
    const handleTyping = (data: { conversationId: string; isTyping: boolean }) => {
      if (data.conversationId !== conversationId) return;
      setIsTyping(data.isTyping);
      // Reset live token count when typing starts
      if (data.isTyping) {
        setLiveTokenCount(0);
      }
    };

    // Handle live token updates
    const handleTokenUpdate = (data: {
      conversationId: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }) => {
      if (data.conversationId !== conversationId) return;
      setLiveTokenCount(data.totalTokens);
    };

    // Handle metadata updates
    const handleMetadata = (data: { conversationId: string; metadata: ConversationMetadata }) => {
      if (data.conversationId !== conversationId) return;
      console.log('[AssistantPanel] Received metadata update:', data.metadata);
      setMetadata(data.metadata);
    };

    socket.on('assistant:stream', handleStream);
    socket.on('assistant:complete', handleComplete);
    socket.on('assistant:error', handleError);
    socket.on('assistant:typing', handleTyping);
    socket.on('assistant:token-update', handleTokenUpdate);
    socket.on('assistant:metadata', handleMetadata);

    return () => {
      socket.off('assistant:stream', handleStream);
      socket.off('assistant:complete', handleComplete);
      socket.off('assistant:error', handleError);
      socket.off('assistant:typing', handleTyping);
      socket.off('assistant:token-update', handleTokenUpdate);
      socket.off('assistant:metadata', handleMetadata);
    };
  }, [websocket, conversationId]);

  const handleSend = () => {
    const message = inputValue.trim();
    if (!message || isStreaming) return;

    // Add user message immediately
    const userMessage: AssistantMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Add to input history (avoid duplicates of last message)
    setInputHistory((prev) => {
      if (prev[prev.length - 1] === message) {
        return prev;
      }
      return [...prev, message];
    });

    setInputValue('');
    setHistoryPosition(-1);
    setError(null);

    // Send to server
    const socket = websocket.getSocket();
    if (socket) {
      socket.emit('assistant:message', {
        message,
        conversationId,
      });
    }

    // Focus back on input
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (inputHistory.length === 0) return;

      const newPosition = historyPosition === -1 ? inputHistory.length - 1 : Math.max(0, historyPosition - 1);
      setHistoryPosition(newPosition);
      setInputValue(inputHistory[newPosition]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPosition === -1) return;

      const newPosition = historyPosition + 1;
      if (newPosition >= inputHistory.length) {
        setHistoryPosition(-1);
        setInputValue('');
      } else {
        setHistoryPosition(newPosition);
        setInputValue(inputHistory[newPosition]);
      }
    }
  };

  // Input change handler for textarea - kept for potential future implementation
  // Currently not used as input handling is done via controlled component pattern
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // If user is typing manually (not from arrow key navigation), reset history position
    if (historyPosition !== -1 && newValue !== inputHistory[historyPosition]) {
      setHistoryPosition(-1);
    }
  };
  void handleInputChange; // Suppress unused warning - kept for future use

  const handleClearHistory = () => {
    Modal.confirm({
      title: 'Clear Conversation History',
      content: 'Are you sure you want to clear all messages? This action cannot be undone.',
      okText: 'Clear History',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        const socket = websocket.getSocket();
        if (socket) {
          socket.emit('assistant:clearHistory', { conversationId });
          setMessages([]);
          setError(null);
          setMetadata({
            tools_called: [],
            commands_executed: [],
            session_start: Date.now(),
            total_tool_calls: 0,
            total_commands: 0,
          });
          clearConversation(conversationId);
          message.success('Conversation history cleared');
        }
      },
    });
  };

  const handleRetry = (messageId: string) => {
    // Find the assistant message being retried
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Find the preceding user message
    let userMessage: AssistantMessage | null = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i];
        break;
      }
    }

    if (!userMessage) {
      message.error('Could not find the original question to retry');
      return;
    }

    // Remove the assistant message being retried and any subsequent messages
    setMessages(prev => prev.slice(0, messageIndex));

    // Re-send the user message
    const socket = websocket.getSocket();
    if (socket) {
      socket.emit('assistant:message', {
        message: userMessage.content,
        conversationId,
      });

      message.info('Retrying response...');
    }
  };

  const handleRunCommand = (command: string) => {
    if (onRunCommand) {
      onRunCommand(command);
      // Show success notification
      message.success({
        content: 'Command sent to terminal',
        duration: 2,
      });
    } else {
      // Fallback: send command directly to terminal via websocket
      const socket = websocket.getSocket();
      if (socket) {
        socket.emit('terminal:execute', {
          command: command,
          sessionId: terminalId
        });

        // Show success notification
        message.success({
          content: 'Command sent to terminal',
          duration: 2,
        });
      } else {
        // Show error if websocket not available
        message.error({
          content: 'Failed to send command: Terminal not connected',
          duration: 3,
        });
      }
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {!hideHeader && (
          <div className={styles.header}>
            <h3 className={styles.title}>AI Assistant</h3>
            <div className={styles.headerActions}>
              <Button
                icon={<InfoCircleOutlined />}
                onClick={() => setShowSessionInfo(!showSessionInfo)}
                title="Toggle session info panel"
                className={styles.infoButton}
              >
                {showSessionInfo ? 'Hide Info' : 'Show Info'}
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={handleClearHistory}
                title="Start a new conversation session"
                disabled={messages.length === 0 || isStreaming}
                className={styles.clearButton}
              >
                New Session
              </Button>
            </div>
          </div>
        )}

        <div className={styles.messagesContainer}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <p>Hello! I'm your MikroTik assistant.</p>
            <p>Ask me anything about your router configuration, network setup, or troubleshooting.</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={message.isStreaming}
            onRunCommand={handleRunCommand}
            onRetry={handleRetry}
          />
        ))}

        {isTyping && !isStreaming && (
          <div className={styles.typingIndicator}>
            <div className={styles.thinkingContent}>
              <div className={styles.thinkingDots}>
                <span className={styles.dot}></span>
                <span className={styles.dot}></span>
                <span className={styles.dot}></span>
              </div>
              <span className={styles.thinkingText}>
                Processing your request...
                {liveTokenCount > 0 && (
                  <span className={styles.tokenCount}> ({liveTokenCount.toLocaleString()} tokens)</span>
                )}
              </span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill}></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputContainer}>
        <EnhancedInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your MikroTik router..."
          disabled={isStreaming}
          maxLength={2000}
          showToolbar={true}
          showShortcuts={true}
        />
      </div>

        {error && !messages.some((m) => m.error) && (
          <div className={styles.errorBanner}>
            <ExclamationCircleOutlined /> {error}
          </div>
        )}
      </div>

      {/* Session Info Side Panel */}
      {showSessionInfo && (
        <div className={styles.sidePanel}>
          <SessionInfoPanel
            metadata={metadata}
            tools={availableTools}
            modelInfo={modelInfo}
            isLoading={isLoadingTools}
            visibleSections={sidePanelSections}
          />
        </div>
      )}
    </div>
  );
};
