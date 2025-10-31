import React, { useState } from 'react';
import { 
  SendOutlined, 
  DatabaseOutlined, 
  CodeOutlined, 
  ThunderboltOutlined,
  QuestionCircleOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import styles from './EnhancedInput.module.css';

export interface EnhancedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  showToolbar?: boolean;
  showShortcuts?: boolean;
  quickActions?: QuickAction[];
}

export interface QuickAction {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  tooltip?: string;
}

export const EnhancedInput: React.FC<EnhancedInputProps> = ({
  value,
  onChange,
  onSend,
  onKeyDown,
  placeholder = 'Ask a question...',
  disabled = false,
  maxLength = 2000,
  showToolbar = true,
  showShortcuts = true,
  quickActions = []
}) => {
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= maxLength) {
      onChange(e.target.value);
    }
  };

  const handleClear = () => {
    onChange('');
  };

  const handleInsertTemplate = (template: string) => {
    onChange(value + template);
  };

  const charCount = value.length;
  const charPercentage = (charCount / maxLength) * 100;
  const isNearLimit = charPercentage > 80;
  const isAtLimit = charPercentage >= 100;

  const defaultQuickActions: QuickAction[] = [
    {
      icon: <DatabaseOutlined />,
      label: 'Show DHCP',
      action: () => handleInsertTemplate('Show me all DHCP leases'),
      tooltip: 'Show DHCP leases'
    },
    {
      icon: <CodeOutlined />,
      label: 'Firewall',
      action: () => handleInsertTemplate('Show me the firewall rules'),
      tooltip: 'Show firewall rules'
    },
    {
      icon: <ThunderboltOutlined />,
      label: 'Status',
      action: () => handleInsertTemplate('What is the router status?'),
      tooltip: 'Check router status'
    }
  ];

  const allQuickActions = [...quickActions, ...defaultQuickActions];

  return (
    <div className={styles.container}>
      {showToolbar && (
        <div className={styles.toolbar}>
          <div className={styles.quickActions}>
            {allQuickActions.slice(0, 5).map((action, index) => (
              <Tooltip key={index} title={action.tooltip || action.label}>
                <button
                  className={styles.quickAction}
                  onClick={action.action}
                  disabled={disabled}
                  type="button"
                >
                  {action.icon}
                  <span className={styles.quickActionLabel}>{action.label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
          
          <div className={styles.toolbarActions}>
            {showShortcuts && (
              <Tooltip title="Keyboard shortcuts">
                <button
                  className={styles.toolbarButton}
                  onClick={() => setShowShortcutsPanel(!showShortcutsPanel)}
                  type="button"
                >
                  <QuestionCircleOutlined />
                </button>
              </Tooltip>
            )}
            
            {value && (
              <Tooltip title="Clear input">
                <button
                  className={styles.toolbarButton}
                  onClick={handleClear}
                  disabled={disabled}
                  type="button"
                >
                  <ClearOutlined />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      )}

      {showShortcutsPanel && (
        <div className={styles.shortcutsPanel}>
          <div className={styles.shortcutsPanelHeader}>
            <span>Keyboard Shortcuts</span>
            <button 
              className={styles.closeShortcuts}
              onClick={() => setShowShortcutsPanel(false)}
            >
              ×
            </button>
          </div>
          <div className={styles.shortcutsList}>
            <div className={styles.shortcut}>
              <kbd>Enter</kbd>
              <span>Send message</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Shift</kbd> + <kbd>Enter</kbd>
              <span>New line</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>↑</kbd> / <kbd>↓</kbd>
              <span>Navigate history</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
              <span>Clear input</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Esc</kbd>
              <span>Cancel/Close</span>
            </div>
          </div>
        </div>
      )}

      <div className={`${styles.inputWrapper} ${isFocused ? styles.focused : ''} ${disabled ? styles.disabled : ''}`}>
        <textarea
          className={styles.input}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />
        
        <div className={styles.inputFooter}>
          <div className={styles.inputInfo}>
            <span className={`${styles.charCounter} ${isNearLimit ? styles.warning : ''} ${isAtLimit ? styles.error : ''}`}>
              {charCount} / {maxLength}
            </span>
            <span className={styles.hint}>
              {isFocused ? 'Press Enter to send, Shift+Enter for new line' : 'Click to type...'}
            </span>
          </div>
          
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={onSend}
            disabled={!value.trim() || disabled || isAtLimit}
            className={styles.sendButton}
            size="large"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
