import React, { useState, useEffect, useRef } from 'react';
import { Button as AntButton, Input } from 'antd';
import { DeleteOutlined, SendOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Button } from '../../atoms/Button/Button';
import { MessageBubble } from '../../molecules/MessageBubble/MessageBubble';
import type { WebSocketService } from '../../../services/websocket';
import type { AssistantMessage } from '../../../types/assistant';
import styles from './AssistantPanel.module.css';

const { TextArea } = Input;

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

export interface AssistantPanelProps {
  websocket: WebSocketService;
  terminalId: string;
  hideHeader?: boolean;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  websocket,
  terminalId,
  hideHeader,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [modelInfo, setModelInfo] = useState<AIModelInfo | null>(null);

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

  // Fetch AI model information
  useEffect(() => {
    const fetchModelInfo = async () => {
      try {
        const response = await fetch('/api/service/ai-info');
        if (response.ok) {
          const data = await response.json();
          console.log('[AssistantPanel] Model info received:', data);
          setModelInfo(data);
        } else {
          console.error('[AssistantPanel] Failed to fetch model info:', response.status, response.statusText);
        }
      } catch (err) {
        console.error('[AssistantPanel] Error fetching AI model info:', err);
      }
    };

    fetchModelInfo();
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
    const handleComplete = (data: { conversationId: string; messageId: string; fullMessage: string }) => {
      if (data.conversationId !== conversationId) return;

      setIsStreaming(false);
      setIsTyping(false);

      // Mark message as complete
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, isStreaming: false }
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
    };

    socket.on('assistant:stream', handleStream);
    socket.on('assistant:complete', handleComplete);
    socket.on('assistant:error', handleError);
    socket.on('assistant:typing', handleTyping);

    return () => {
      socket.off('assistant:stream', handleStream);
      socket.off('assistant:complete', handleComplete);
      socket.off('assistant:error', handleError);
      socket.off('assistant:typing', handleTyping);
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
    setInputValue('');
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
    }
  };

  const handleClearHistory = () => {
    const socket = websocket.getSocket();
    if (socket) {
      socket.emit('assistant:clearHistory', { conversationId });
      setMessages([]);
      setError(null);
    }
  };

  return (
    <div className={styles.container}>
      {!hideHeader && (
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h3 className={styles.title}>AI Assistant</h3>
            {modelInfo && modelInfo.available ? (
              <div className={styles.modelInfo}>
                <span className={styles.modelName}>{modelInfo.model}</span>
                <span className={styles.separator}>•</span>
                <span className={styles.contextWindow}>
                  {typeof modelInfo.context_window === 'number'
                    ? `${modelInfo.context_window.toLocaleString()} tokens`
                    : modelInfo.context_window}
                </span>
                <span className={styles.separator}>•</span>
                <span className={styles.tokenCost}>
                  ${modelInfo.token_costs.prompt_per_1m}/${modelInfo.token_costs.completion_per_1m} per 1M
                </span>
              </div>
            ) : (
              <div className={styles.modelInfo} style={{ color: '#666', fontSize: '10px' }}>
                {modelInfo ? 'AI unavailable' : 'Loading model info...'}
              </div>
            )}
          </div>
          <AntButton
            icon={<DeleteOutlined />}
            onClick={handleClearHistory}
            title="Clear conversation"
            disabled={messages.length === 0 || isStreaming}
            size="small"
            className={styles.clearButton}
          >
            Clear
          </AntButton>
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
          />
        ))}

        {isTyping && !isStreaming && (
          <div className={styles.typingIndicator}>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputContainer}>
        <TextArea
          ref={inputRef}
          className={styles.input}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question... (Shift+Enter for new line)"
          disabled={isStreaming}
          autoSize={{ minRows: 1, maxRows: 4 }}
        />
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={!inputValue.trim() || isStreaming}
          title="Send message"
          className={styles.sendButton}
        >
          <SendOutlined />
        </Button>
      </div>

      {error && !messages.some((m) => m.error) && (
        <div className={styles.errorBanner}>
          <ExclamationCircleOutlined /> {error}
        </div>
      )}
    </div>
  );
};
