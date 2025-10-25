import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { ExpandOutlined, CompressOutlined, MinusOutlined } from '@ant-design/icons';
import { TerminalPanel } from '../TerminalPanel/TerminalPanel';
import websocket from '../../../services/websocket';
import styles from './ResizableTerminal.module.css';

export interface ResizableTerminalProps {
  onCommand?: (command: string) => void;
}

export const ResizableTerminal: React.FC<ResizableTerminalProps> = ({ onCommand }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [position, setPosition] = useState({ x: 100, y: 100 });

  const handleMaximize = () => {
    if (!isMaximized) {
      setIsMaximized(true);
    } else {
      setIsMaximized(false);
    }
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (isMinimized) {
    return (
      <div className={styles.minimizedBar} onClick={handleMinimize}>
        <span>Terminal (Click to restore)</span>
      </div>
    );
  }

  if (isMaximized) {
    return (
      <div className={styles.maximized}>
        <div className={styles.windowControls}>
          <button 
            className={styles.controlButton} 
            onClick={handleMaximize}
            title="Restore"
          >
            <CompressOutlined />
          </button>
          <button 
            className={styles.controlButton} 
            onClick={handleMinimize}
            title="Minimize"
          >
            <MinusOutlined />
          </button>
        </div>
        <TerminalPanel
          websocket={websocket}
          terminalId="legacy-terminal"
          onCommand={onCommand}
          hideHeader
        />
      </div>
    );
  }

  return (
    <Rnd
      size={size}
      position={position}
      onDragStop={(_e, d) => setPosition({ x: d.x, y: d.y })}
      onResizeStop={(_e, _direction, ref, _delta, _position) => {
        setSize({
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
        });
        setPosition(position);
      }}
      minWidth={500}
      minHeight={400}
      bounds="parent"
      dragHandleClassName={styles.dragHandle}
      className={styles.rndContainer}
    >
      <div className={styles.window}>
        <div className={`${styles.titleBar} ${styles.dragHandle}`}>
          <span className={styles.title}>Terminal</span>
          <div className={styles.windowControls}>
            <button 
              className={styles.controlButton} 
              onClick={handleMinimize}
              title="Minimize"
            >
              <MinusOutlined />
            </button>
            <button 
              className={styles.controlButton} 
              onClick={handleMaximize}
              title="Maximize"
            >
              <ExpandOutlined />
            </button>
          </div>
        </div>
        <div className={styles.content}>
          <TerminalPanel
          websocket={websocket}
          terminalId="legacy-terminal"
          onCommand={onCommand}
          hideHeader
        />
        </div>
      </div>
    </Rnd>
  );
};
