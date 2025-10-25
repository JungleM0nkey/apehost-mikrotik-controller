import React, { useState, useRef, useEffect } from 'react';
import {
  BarChartOutlined,
  GlobalOutlined,
  SafetyOutlined,
  SaveOutlined,
  RobotOutlined,
  UserOutlined
} from '@ant-design/icons';
import { ChatMessage } from '../../../types/chat';
import { Button } from '../../atoms/Button/Button';
import styles from './ChatPanel.module.css';

export interface ChatPanelProps {
  onSendMessage?: (message: string) => void;
  initialMessages?: ChatMessage[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  onSendMessage,
  initialMessages = []
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message on mount
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: '0',
        content: 'Hello! I\'m your MikroTik AI assistant. I can help you with router configuration, troubleshooting, and executing commands. What would you like to do?',
        sender: 'assistant',
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);

  const generateMockResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();
    
    // Router status queries
    if (msg.includes('status') || msg.includes('health')) {
      return 'Your router is currently online and healthy. CPU usage is at 23%, memory usage is 1.2GB out of 2GB. All interfaces are operational except ether3 which is disabled.';
    }
    
    // Configuration help
    if (msg.includes('configure') || msg.includes('setup')) {
      return 'I can help you configure your router. What would you like to set up?\n\n• Firewall rules\n• DHCP server\n• NAT configuration\n• Wireless settings\n• Port forwarding\n\nJust let me know what you need!';
    }
    
    // Firewall questions
    if (msg.includes('firewall')) {
      return 'To manage firewall rules, you can:\n\n1. View current rules: `/ip firewall filter print`\n2. Add a new rule: `/ip firewall filter add chain=forward action=accept`\n3. Remove a rule: `/ip firewall filter remove [id]`\n\nWould you like me to help you create a specific rule?';
    }
    
    // Interface questions
    if (msg.includes('interface')) {
      return 'You have 4 network interfaces configured:\n\n• ether1-gateway (WAN) - UP\n• ether2-local (LAN) - UP\n• ether3 - DOWN\n• wlan1 (Wireless) - UP\n\nWould you like to enable ether3 or configure any interface?';
    }
    
    // Performance questions
    if (msg.includes('slow') || msg.includes('performance')) {
      return 'Let me check your router performance... Based on current stats:\n\n• CPU usage is normal (23%)\n• Memory usage is healthy (59%)\n• No packet drops detected\n• Uptime: 15 days\n\nYour router performance looks good. If you\'re experiencing slowness, it might be bandwidth-related. Would you like me to check your traffic stats?';
    }
    
    // DHCP questions
    if (msg.includes('dhcp')) {
      return 'Your DHCP server is configured on ether2-local with:\n\n• IP pool: 192.168.88.10-192.168.88.254\n• Lease time: 1 day\n• Currently 12 active leases\n\nWould you like to see the list of active clients or modify the DHCP configuration?';
    }
    
    // Backup
    if (msg.includes('backup')) {
      return 'I can help you create a backup. To backup your configuration:\n\n1. Go to Settings → Security\n2. Click "Export Logs" to download current config\n3. Or I can execute: `/system backup save name=backup-' + new Date().toISOString().split('T')[0] + '`\n\nWould you like me to create a backup now?';
    }
    
    // Default helpful response
    return 'I understand you\'re asking about: "' + userMessage + '"\n\nI can help you with:\n• Router status and monitoring\n• Configuration changes\n• Troubleshooting issues\n• Executing RouterOS commands\n• Security and firewall setup\n\nCould you provide more details about what you\'d like to do?';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Show typing indicator
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const response = generateMockResponse(inputValue);
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'assistant',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000); // Random delay 1-2 seconds

    // Callback
    if (onSendMessage) {
      onSendMessage(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const quickActions = [
    { id: 'status', label: 'Router Status', icon: <BarChartOutlined /> },
    { id: 'interfaces', label: 'Check Interfaces', icon: <GlobalOutlined /> },
    { id: 'firewall', label: 'Firewall Rules', icon: <SafetyOutlined /> },
    { id: 'backup', label: 'Create Backup', icon: <SaveOutlined /> }
  ];

  const handleQuickAction = (action: string) => {
    const actionMessages: Record<string, string> = {
      status: 'Show me the router status',
      interfaces: 'What are my network interfaces?',
      firewall: 'Show me firewall configuration',
      backup: 'How do I create a backup?'
    };

    setInputValue(actionMessages[action] || '');
    inputRef.current?.focus();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <RobotOutlined className={styles.headerIcon} />
          <div>
            <h3 className={styles.headerTitle}>AI Assistant</h3>
            <span className={styles.headerSubtitle}>Powered by Claude</span>
          </div>
        </div>
        <div className={styles.statusBadge}>
          <span className={styles.statusDot} />
          <span>Online</span>
        </div>
      </div>

      <div className={styles.messages}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${styles[message.sender]}`}
          >
            <div className={styles.messageAvatar}>
              {message.sender === 'user' ? <UserOutlined /> : <RobotOutlined />}
            </div>
            <div className={styles.messageContent}>
              <div className={styles.messageText}>{message.content}</div>
              <div className={styles.messageTime}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.messageAvatar}>
              <RobotOutlined />
            </div>
            <div className={styles.messageContent}>
              <div className={styles.typingIndicator}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.quickActions}>
        {quickActions.map((action) => (
          <button
            key={action.id}
            className={styles.quickActionBtn}
            onClick={() => handleQuickAction(action.id)}
          >
            <span className={styles.quickActionIcon}>{action.icon}</span>
            <span className={styles.quickActionLabel}>{action.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about your MikroTik router..."
          className={styles.input}
          rows={1}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!inputValue.trim() || isTyping}
          className={styles.sendButton}
        >
          Send
        </Button>
      </form>

      <div className={styles.footer}>
        <span className={styles.footerHint}>
          Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
        </span>
      </div>
    </div>
  );
};
