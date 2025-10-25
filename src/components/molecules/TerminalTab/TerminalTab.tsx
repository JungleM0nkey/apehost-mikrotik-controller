import React, { useState, useRef, useEffect } from 'react';
import { CloseOutlined, CodeOutlined } from '@ant-design/icons';
import type { Terminal } from '../../../types/terminal-manager';
import styles from './TerminalTab.module.css';

export interface TerminalTabProps {
  terminal: Terminal;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({
  terminal,
  onActivate,
  onClose,
  onRename,
  onDuplicate,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [editedName, setEditedName] = useState(terminal.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = (e: React.MouseEvent) => {
    if (isRenaming) return;
    e.stopPropagation();
    onActivate(terminal.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
    setEditedName(terminal.name);
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(terminal.id);
  };

  const handleRenameSubmit = () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== terminal.name) {
      onRename(terminal.id, trimmedName);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setEditedName(terminal.name);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleRenameFromMenu = () => {
    setIsRenaming(true);
    setEditedName(terminal.name);
    closeContextMenu();
  };

  const handleDuplicateFromMenu = () => {
    onDuplicate(terminal.id);
    closeContextMenu();
  };

  const handleCloseFromMenu = () => {
    onClose(terminal.id);
    closeContextMenu();
  };

  // Close context menu on click outside
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu();
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeContextMenu();
      };

      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [contextMenu]);

  const tabClassName = `${styles.terminalTab} ${
    terminal.isActive ? styles.active : ''
  } ${terminal.isMinimized ? styles.minimized : ''}`;

  return (
    <>
      <div
        className={tabClassName}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        aria-label={`${terminal.name}, ${terminal.isActive ? 'active' : 'inactive'}`}
      >
        {/* Terminal Icon */}
        <div className={styles.iconContainer}>
          <CodeOutlined className={styles.terminalIcon} />
        </div>

        {/* Terminal Name */}
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            className={styles.nameInput}
            maxLength={20}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.name} title={terminal.name}>
            {terminal.name}
          </span>
        )}

        {/* Close Button */}
        <button
          className={styles.closeButton}
          onClick={handleCloseClick}
          aria-label={`Close ${terminal.name}`}
          title="Close terminal"
        >
          <CloseOutlined />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={styles.contextMenuItem} onClick={handleRenameFromMenu}>
            Rename
          </button>
          <button className={styles.contextMenuItem} onClick={handleDuplicateFromMenu}>
            Duplicate
          </button>
          <div className={styles.contextMenuDivider} />
          <button className={styles.contextMenuItem} onClick={handleCloseFromMenu}>
            Close
          </button>
        </div>
      )}
    </>
  );
};
