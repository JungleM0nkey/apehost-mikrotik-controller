import React from 'react';
import { ChatPanel } from '../../components/organisms/ChatPanel/ChatPanel';
import styles from './ChatPage.module.css';

export const ChatPage: React.FC = () => {
  const handleSendMessage = (message: string) => {
    console.log('Message sent:', message);
    // Will be replaced with actual API call in Phase 2
  };

  return (
    <div className={styles.container}>
      <div className={styles.chatContainer}>
        <ChatPanel onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};
