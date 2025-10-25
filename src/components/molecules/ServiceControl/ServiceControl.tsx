import React, { useState, useEffect, useRef } from 'react';
import { Badge } from 'antd';
import { PoweroffOutlined, ReloadOutlined, InfoCircleOutlined, PlayCircleOutlined, CopyOutlined } from '@ant-design/icons';
import styles from './ServiceControl.module.css';

export interface ServiceInfo {
  service: string;
  status: 'online' | 'offline' | 'connecting';
  addresses?: string[];
  port?: string;
  uptime?: number;
  uptimeFormatted?: string;
  pid?: number;
  nodeVersion?: string;
  memory?: {
    used: number;
    total: number;
  };
}

export interface ServiceControlProps {
  serviceName: 'Frontend' | 'Backend';
  status: 'online' | 'offline' | 'connecting';
  serviceInfo?: ServiceInfo;
  onRestart?: () => void;
  onShutdown?: () => void;
  onRefresh?: () => void;
}

export const ServiceControl: React.FC<ServiceControlProps> = ({
  serviceName,
  status,
  serviceInfo,
  onRestart,
  onShutdown,
  onRefresh,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (action: 'restart' | 'shutdown' | 'refresh') => {
    setIsOpen(false);

    if (action === 'restart' && onRestart) {
      if (window.confirm(`Are you sure you want to restart the ${serviceName} service?`)) {
        onRestart();
      }
    } else if (action === 'shutdown' && onShutdown) {
      if (window.confirm(`Are you sure you want to shutdown the ${serviceName} service?`)) {
        onShutdown();
      }
    } else if (action === 'refresh' && onRefresh) {
      onRefresh();
    }
  };

  const getBadgeStatus = () => {
    if (status === 'online') return 'success';
    if (status === 'connecting') return 'processing';
    return 'error';
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <div
        className={styles.badge}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Badge
          status={getBadgeStatus()}
          text={
            <span className={styles.badgeText}>
              {serviceName}
            </span>
          }
        />
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <InfoCircleOutlined className={styles.headerIcon} />
            <span className={styles.headerTitle}>{serviceName} Service</span>
          </div>

          <div className={styles.dropdownContent}>
            {/* Status */}
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Status:</span>
              <span className={`${styles.infoValue} ${styles[status]}`}>
                {status.toUpperCase()}
              </span>
            </div>

            {/* Service Info */}
            {serviceInfo && status === 'online' && (
              <>
                {/* Addresses */}
                {serviceInfo.addresses && serviceInfo.addresses.length > 0 && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Address:</span>
                    <div className={styles.infoValue}>
                      {serviceInfo.addresses.map((addr, idx) => (
                        <div key={idx} className={styles.addressItem}>
                          {addr}:{serviceInfo.port}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Port */}
                {serviceInfo.port && !serviceInfo.addresses && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Port:</span>
                    <span className={styles.infoValue}>{serviceInfo.port}</span>
                  </div>
                )}

                {/* Uptime */}
                {serviceInfo.uptimeFormatted && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Uptime:</span>
                    <span className={styles.infoValue}>{serviceInfo.uptimeFormatted}</span>
                  </div>
                )}

                {/* Memory */}
                {serviceInfo.memory && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Memory:</span>
                    <span className={styles.infoValue}>
                      {serviceInfo.memory.used}MB / {serviceInfo.memory.total}MB
                    </span>
                  </div>
                )}

                {/* PID */}
                {serviceInfo.pid && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>PID:</span>
                    <span className={styles.infoValue}>{serviceInfo.pid}</span>
                  </div>
                )}

                {/* Node Version */}
                {serviceInfo.nodeVersion && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Node:</span>
                    <span className={styles.infoValue}>{serviceInfo.nodeVersion}</span>
                  </div>
                )}
              </>
            )}

            {/* Actions - Online */}
            {status === 'online' && (serviceName === 'Backend') && (
              <>
                <div className={styles.divider} />
                <div className={styles.actions}>
                  {onRefresh && (
                    <button
                      className={`${styles.actionButton} ${styles.refresh}`}
                      onClick={() => handleAction('refresh')}
                    >
                      <ReloadOutlined />
                      Refresh Info
                    </button>
                  )}
                  {onRestart && (
                    <button
                      className={`${styles.actionButton} ${styles.restart}`}
                      onClick={() => handleAction('restart')}
                    >
                      <ReloadOutlined />
                      Restart Service
                    </button>
                  )}
                  {onShutdown && (
                    <button
                      className={`${styles.actionButton} ${styles.shutdown}`}
                      onClick={() => handleAction('shutdown')}
                    >
                      <PoweroffOutlined />
                      Shutdown Service
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Actions - Offline */}
            {status === 'offline' && serviceName === 'Backend' && (
              <>
                <div className={styles.divider} />
                <div className={styles.offlineHelp}>
                  <div className={styles.offlineTitle}>
                    <PlayCircleOutlined /> Start Backend Server
                  </div>
                  <div className={styles.offlineText}>
                    Run one of these commands in your terminal:
                  </div>
                  <div className={styles.commandBox}>
                    <code>cd server && npm run dev</code>
                    <button
                      className={styles.copyButton}
                      onClick={() => {
                        navigator.clipboard.writeText('cd server && npm run dev');
                        setIsOpen(false);
                      }}
                      title="Copy to clipboard"
                    >
                      <CopyOutlined />
                    </button>
                  </div>
                  <div className={styles.offlineText} style={{ marginTop: '8px' }}>
                    Or from project root:
                  </div>
                  <div className={styles.commandBox}>
                    <code>npm run dev:backend</code>
                    <button
                      className={styles.copyButton}
                      onClick={() => {
                        navigator.clipboard.writeText('npm run dev:backend');
                        setIsOpen(false);
                      }}
                      title="Copy to clipboard"
                    >
                      <CopyOutlined />
                    </button>
                  </div>
                  <div className={styles.offlineText} style={{ marginTop: '8px' }}>
                    Or run both frontend & backend:
                  </div>
                  <div className={styles.commandBox}>
                    <code>npm run dev:full</code>
                    <button
                      className={styles.copyButton}
                      onClick={() => {
                        navigator.clipboard.writeText('npm run dev:full');
                        setIsOpen(false);
                      }}
                      title="Copy to clipboard"
                    >
                      <CopyOutlined />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
