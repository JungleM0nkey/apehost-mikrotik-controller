import React from 'react';
import { Button, message as notification } from 'antd';
import { CopyOutlined, ExclamationCircleOutlined, PlayCircleOutlined, RedoOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AssistantMessage } from '../../../types/assistant';
import { TokenCostBadge } from '../../atoms/TokenCostBadge/TokenCostBadge';
import styles from './MessageBubble.module.css';

export interface MessageBubbleProps {
  message: AssistantMessage;
  isStreaming?: boolean;
  onRunCommand?: (command: string) => void;
  onRetry?: (messageId: string) => void;
}

// Strip emojis from text
const stripEmojis = (text: string): string => {
  // Comprehensive emoji regex pattern
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F251}]|[\u{00A9}]|[\u{00AE}]|[\u{203C}]|[\u{2049}]|[\u{2122}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{2328}]|[\u{23CF}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{E0020}-\u{E007F}]|[\u{FE0E}-\u{FE0F}]/gu;

  return text.replace(emojiRegex, '');
};

// Detect RouterOS commands in code blocks
const isRouterOSCommand = (code: string, language?: string): boolean => {
  if (language === 'routeros' || language === 'mikrotik') return true;

  // Check if it starts with common RouterOS command prefixes
  const routerOSPrefixes = [
    '/ip ', '/interface ', '/system ', '/user ', '/log ',
    '/tool ', '/routing ', '/queue ', '/firewall ', '/certificate ',
    '/port ', '/radius ', '/snmp ', '/file ', '/import ', '/export '
  ];

  return routerOSPrefixes.some(prefix => code.trim().startsWith(prefix));
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming,
  onRunCommand,
  onRetry
}) => {
  const isUser = message.role === 'user';
  const [runningCommand, setRunningCommand] = React.useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      notification.success({
        content: 'Message copied to clipboard',
        duration: 2,
      });
    } catch (err) {
      notification.error({
        content: 'Failed to copy message',
        duration: 2,
      });
    }
  };

  const handleCopyCommand = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      notification.success({
        content: 'Command copied to clipboard',
        duration: 2,
      });
    } catch (err) {
      notification.error({
        content: 'Failed to copy command',
        duration: 2,
      });
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(message.id);
    }
  };

  const handleRunCommand = (command: string) => {
    if (onRunCommand) {
      setRunningCommand(command);
      onRunCommand(command);

      // Clear running state after animation
      setTimeout(() => {
        setRunningCommand(null);
      }, 1500);
    }
  };

  // Custom renderer for code blocks to add "Run Command" button
  const components = {
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');
      
      if (!inline && isRouterOSCommand(code, match?.[1])) {
        return (
          <div className={styles.commandBlock}>
            <div className={styles.commandHeader}>
              <span className={styles.commandLabel}>RouterOS Command</span>
              <div className={styles.commandActions}>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopyCommand(code)}
                  title="Copy command"
                >
                  Copy
                </Button>
                {onRunCommand && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleRunCommand(code)}
                    title="Run this command in terminal"
                    loading={runningCommand === code}
                  >
                    {runningCommand === code ? 'Sent' : 'Run Command'}
                  </Button>
                )}
              </div>
            </div>
            <pre className={styles.commandCode}>
              <code {...props} className={className}>
                {children}
              </code>
            </pre>
          </div>
        );
      }
      
      // Regular code block
      return (
        <code {...props} className={className}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className={`${styles.bubbleContainer} ${isUser ? styles.userContainer : styles.assistantContainer}`}>
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        {isUser ? (
          <p className={styles.content}>{message.content}</p>
        ) : (
          <div className={styles.markdown}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {stripEmojis(message.content)}
            </ReactMarkdown>
            {isStreaming && <span className={styles.cursor}>▊</span>}
          </div>
        )}
        {message.error && (
          <div className={styles.error}>
            <ExclamationCircleOutlined /> <span>{message.error}</span>
          </div>
        )}
        <div className={styles.meta}>
          <div className={styles.metaLeft}>
            <span className={styles.timestamp}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {!isUser && message.usage && !isStreaming && (
              <TokenCostBadge usage={message.usage} />
            )}
          </div>
          {!isStreaming && (
            <div className={styles.actions}>
              {!isUser && onRetry && (
                <Button
                  type="text"
                  size="small"
                  icon={<RedoOutlined />}
                  onClick={handleRetry}
                  title="Retry this response"
                  className={styles.retryButton}
                />
              )}
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopy}
                title="Copy message"
                className={styles.copyButton}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
