import React from 'react';
import { Button } from 'antd';
import { CopyOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AssistantMessage } from '../../../types/assistant';
import styles from './MessageBubble.module.css';

export interface MessageBubbleProps {
  message: AssistantMessage;
  isStreaming?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming }) => {
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  return (
    <div className={`${styles.bubbleContainer} ${isUser ? styles.userContainer : styles.assistantContainer}`}>
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        {isUser ? (
          <p className={styles.content}>{message.content}</p>
        ) : (
          <div className={styles.markdown}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            {isStreaming && <span className={styles.cursor}>▊</span>}
          </div>
        )}
        {message.error && (
          <div className={styles.error}>
            <ExclamationCircleOutlined /> <span>{message.error}</span>
          </div>
        )}
        <div className={styles.meta}>
          <span className={styles.timestamp}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {!isStreaming && (
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={handleCopy}
              title="Copy message"
              className={styles.copyButton}
            />
          )}
        </div>
      </div>
    </div>
  );
};
