import React, { useState, useEffect } from 'react';
import { Tabs, message as antMessage } from 'antd';
import {
  CommentOutlined,
  WarningOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BuildOutlined,
  ReloadOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  CopyOutlined,
  PoweroffOutlined,
  EyeOutlined
} from '@ant-design/icons';
import api from '../../services/api';
import type { NetworkInterface } from '../../types/api';
import styles from './NetworkPage.module.css';

interface InterfaceCardProps {
  iface: NetworkInterface;
  onUpdate: (id: string, updates: { name?: string; comment?: string; disabled?: boolean }) => Promise<void>;
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
}

const InterfaceCard: React.FC<InterfaceCardProps> = ({ iface, onUpdate, isEditing, onEditStart, onEditEnd }) => {
  const [editName, setEditName] = useState(iface.name);
  const [editComment, setEditComment] = useState(iface.comment || '');
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{x: number; y: number} | null>(null);
  const isDisabled = iface.status === 'down';

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatRate = (rate: number): string => {
    if (rate === 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(rate) / Math.log(k));
    return `${(rate / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const handleToggleStatus = async () => {
    setIsSaving(true);
    try {
      await onUpdate(iface.id, { disabled: !isDisabled });
    } catch (error) {
      console.error('Failed to toggle interface status:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(iface.id, {
        name: editName !== iface.name ? editName : undefined,
        comment: editComment !== iface.comment ? editComment : undefined
      });
      onEditEnd();
    } catch (error) {
      console.error('Failed to save interface changes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(iface.name);
    setEditComment(iface.comment || '');
    onEditEnd();
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    // Menu dimensions (approximate)
    const menuWidth = 200;
    const menuHeight = 160;

    // Viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate position with boundary detection
    let x = e.clientX;
    let y = e.clientY;

    // Prevent overflow on right edge
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }

    // Prevent overflow on bottom edge
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    // Prevent overflow on left edge
    if (x < 10) {
      x = 10;
    }

    // Prevent overflow on top edge
    if (y < 10) {
      y = 10;
    }

    setContextMenu({ x, y });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleCopyName = async () => {
    try {
      await navigator.clipboard.writeText(iface.name);
      antMessage.success(`Copied "${iface.name}" to clipboard`);
      closeContextMenu();
    } catch (err) {
      console.error('Failed to copy:', err);
      antMessage.error('Failed to copy to clipboard');
    }
  };

  const handleContextEdit = () => {
    onEditStart();
    closeContextMenu();
  };

  const handleContextToggle = async () => {
    closeContextMenu();
    await handleToggleStatus();
  };

  const handleRefreshStats = () => {
    closeContextMenu();
    antMessage.info('Interface stats refreshing...');
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => closeContextMenu();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };

    if (contextMenu) {
      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [contextMenu]);

  return (
    <div
      className={`${styles.interfaceCard} ${isEditing ? styles.interfaceCardEditing : ''}`}
      onContextMenu={handleContextMenu}
    >
      <div className={styles.interfaceHeader}>
        <div className={styles.interfaceTitle}>
          <span className={`${styles.statusIndicator} ${styles[iface.status]}`} />
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={styles.interfaceNameInput}
              disabled={isSaving}
            />
          ) : (
            <h3 className={styles.interfaceName}>{iface.name}</h3>
          )}
          <span className={styles.interfaceType}>{iface.type}</span>
        </div>
        <div className={styles.interfaceActions}>
          <button
            className={`${styles.toggleSwitch} ${!isDisabled ? styles.toggleActive : ''}`}
            onClick={handleToggleStatus}
            disabled={isSaving}
            aria-label={`Toggle interface ${isDisabled ? 'on' : 'off'}`}
          >
            <span className={styles.toggleTrack}>
              <span className={styles.toggleThumb} />
            </span>
            <span className={styles.toggleLabel}>
              {!isDisabled ? 'ON' : 'OFF'}
            </span>
          </button>
          {!isEditing ? (
            <button
              className={styles.editButton}
              onClick={onEditStart}
              disabled={isSaving}
              title="Edit Interface"
            >
              <EditOutlined />
            </button>
          ) : (
            <div className={styles.editActions}>
              <button
                className={styles.saveButton}
                onClick={handleSave}
                disabled={isSaving}
                title="Save Changes"
              >
                <SaveOutlined />
              </button>
              <button
                className={styles.cancelButton}
                onClick={handleCancel}
                disabled={isSaving}
                title="Cancel"
              >
                <CloseOutlined />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.interfaceStats}>
        <div className={styles.statGroup}>
          <div className={styles.statLabel}>RX Rate</div>
          <div className={styles.statValue}>{formatRate(iface.rxRate)}</div>
        </div>
        <div className={styles.statGroup}>
          <div className={styles.statLabel}>TX Rate</div>
          <div className={styles.statValue}>{formatRate(iface.txRate)}</div>
        </div>
        <div className={styles.statGroup}>
          <div className={styles.statLabel}>RX Bytes</div>
          <div className={styles.statValue}>{formatBytes(iface.rxBytes)}</div>
        </div>
        <div className={styles.statGroup}>
          <div className={styles.statLabel}>TX Bytes</div>
          <div className={styles.statValue}>{formatBytes(iface.txBytes)}</div>
        </div>
      </div>

      <div className={styles.interfaceComment}>
        <CommentOutlined className={styles.commentIcon} />
        {isEditing ? (
          <input
            type="text"
            value={editComment}
            onChange={(e) => setEditComment(e.target.value)}
            className={styles.commentInput}
            placeholder="Add a comment..."
            disabled={isSaving}
          />
        ) : (
          <span className={styles.commentText}>{iface.comment || 'No comment'}</span>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={styles.contextMenuItem} onClick={handleCopyName}>
            <CopyOutlined className={styles.contextMenuIcon} />
            <span>Copy Name</span>
          </button>
          <button className={styles.contextMenuItem} onClick={handleContextEdit}>
            <EditOutlined className={styles.contextMenuIcon} />
            <span>Edit Interface</span>
          </button>
          <button className={styles.contextMenuItem} onClick={handleRefreshStats}>
            <ReloadOutlined className={styles.contextMenuIcon} />
            <span>Refresh Stats</span>
          </button>
          <div className={styles.contextMenuDivider} />
          <button className={styles.contextMenuItem} onClick={handleContextToggle}>
            <PoweroffOutlined className={styles.contextMenuIcon} />
            <span>{isDisabled ? 'Enable' : 'Disable'} Interface</span>
          </button>
          <button className={styles.contextMenuItem}>
            <EyeOutlined className={styles.contextMenuIcon} />
            <span>View Details</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const NetworkPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('interfaces');
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingInterfaceId, setEditingInterfaceId] = useState<string | null>(null);

  const fetchInterfaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getInterfaces();
      setInterfaces(data);
    } catch (err) {
      console.error('Failed to fetch interfaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load interfaces');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInterface = async (
    id: string,
    updates: { name?: string; comment?: string; disabled?: boolean }
  ) => {
    try {
      await api.updateInterface(id, updates);
      await fetchInterfaces();
    } catch (err) {
      console.error('Failed to update interface:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchInterfaces();

    // Refresh every 3 seconds
    const interval = setInterval(fetchInterfaces, 3000);

    return () => clearInterval(interval);
  }, []);

  const activeInterfaces = interfaces.filter(i => i.status === 'up');
  const inactiveInterfaces = interfaces.filter(i => i.status === 'down');

  const renderContent = () => {
    if (loading && interfaces.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.spinner} />
          <p>Loading network information...</p>
        </div>
      );
    }

    if (error && interfaces.length === 0) {
      return (
        <div className={styles.emptyState}>
          <WarningOutlined className={styles.errorIcon} />
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryButton} onClick={fetchInterfaces}>
            Retry
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'interfaces':
        return (
          <div className={styles.content}>
            {/* Summary Stats */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <ApiOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{interfaces.length}</div>
                  <div className={styles.summaryLabel}>Total Interfaces</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CheckCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{activeInterfaces.length}</div>
                  <div className={styles.summaryLabel}>Active</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CloseCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{inactiveInterfaces.length}</div>
                  <div className={styles.summaryLabel}>Inactive</div>
                </div>
              </div>
            </div>

            {/* Active Interfaces */}
            {activeInterfaces.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  Active Interfaces
                  <span className={styles.sectionCount}>{activeInterfaces.length}</span>
                </h2>
                <div className={styles.interfaceGrid}>
                  {activeInterfaces.map((iface) => (
                    <InterfaceCard
                      key={iface.id}
                      iface={iface}
                      onUpdate={handleUpdateInterface}
                      isEditing={editingInterfaceId === iface.id}
                      onEditStart={() => setEditingInterfaceId(iface.id)}
                      onEditEnd={() => setEditingInterfaceId(null)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Interfaces */}
            {inactiveInterfaces.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  Inactive Interfaces
                  <span className={styles.sectionCount}>{inactiveInterfaces.length}</span>
                </h2>
                <div className={styles.interfaceGrid}>
                  {inactiveInterfaces.map((iface) => (
                    <InterfaceCard
                      key={iface.id}
                      iface={iface}
                      onUpdate={handleUpdateInterface}
                      isEditing={editingInterfaceId === iface.id}
                      onEditStart={() => setEditingInterfaceId(iface.id)}
                      onEditEnd={() => setEditingInterfaceId(null)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'addresses':
        return (
          <div className={styles.content}>
            <div className={styles.comingSoon}>
              <BuildOutlined className={styles.comingSoonIcon} />
              <h3>IP Addresses</h3>
              <p>Coming soon - View and manage IP address assignments</p>
            </div>
          </div>
        );

      case 'routes':
        return (
          <div className={styles.content}>
            <div className={styles.comingSoon}>
              <BuildOutlined className={styles.comingSoonIcon} />
              <h3>Routing Table</h3>
              <p>Coming soon - View and manage routing table entries</p>
            </div>
          </div>
        );

      case 'arp':
        return (
          <div className={styles.content}>
            <div className={styles.comingSoon}>
              <BuildOutlined className={styles.comingSoonIcon} />
              <h3>ARP Table</h3>
              <p>Coming soon - View ARP cache and connected devices</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* Focus Overlay */}
      {editingInterfaceId && (
        <div
          className={styles.focusOverlay}
          onClick={() => setEditingInterfaceId(null)}
        />
      )}

      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Network</h1>
          <p className={styles.subtitle}>Manage network interfaces, addresses, and routing</p>
        </div>
        <button className={styles.refreshButton} onClick={fetchInterfaces}>
          <ReloadOutlined className={styles.refreshIcon} />
          Refresh
        </button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'interfaces',
            label: 'Interfaces'
          },
          {
            key: 'addresses',
            label: 'IP Addresses'
          },
          {
            key: 'routes',
            label: 'Routes'
          },
          {
            key: 'arp',
            label: 'ARP Table'
          }
        ]}
      />

      {renderContent()}
    </div>
  );
};
