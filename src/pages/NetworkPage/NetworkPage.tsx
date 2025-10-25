import React, { useState, useEffect } from 'react';
import { Tabs, message as antMessage } from 'antd';
import {
  CommentOutlined,
  WarningOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  CopyOutlined,
  PoweroffOutlined,
  EyeOutlined
} from '@ant-design/icons';
import api from '../../services/api';
import type { NetworkInterface, IpAddress, Route, ArpEntry } from '../../types/api';
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
  const [ipAddresses, setIpAddresses] = useState<IpAddress[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [arpEntries, setArpEntries] = useState<ArpEntry[]>([]);
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

  const fetchIpAddresses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getIpAddresses();
      setIpAddresses(data);
    } catch (err) {
      console.error('Failed to fetch IP addresses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load IP addresses');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getRoutes();
      setRoutes(data);
    } catch (err) {
      console.error('Failed to fetch routes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  };

  const fetchArpTable = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getArpTable();
      setArpEntries(data);
    } catch (err) {
      console.error('Failed to fetch ARP table:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ARP table');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = () => {
    switch (activeTab) {
      case 'interfaces':
        fetchInterfaces();
        break;
      case 'addresses':
        fetchIpAddresses();
        break;
      case 'routes':
        fetchRoutes();
        break;
      case 'arp':
        fetchArpTable();
        break;
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
    fetchData();

    // Refresh every 3 seconds
    const interval = setInterval(fetchData, 3000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const activeInterfaces = interfaces.filter(i => i.status === 'up');
  const inactiveInterfaces = interfaces.filter(i => i.status === 'down');

  const handleCopyToClipboard = async (text: string, label: string) => {
    // Method 1: Modern Clipboard API (works on HTTPS and localhost)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        antMessage.success(`${label} copied to clipboard`);
        return;
      } catch (err) {
        console.warn('Clipboard API failed, trying fallback...', err);
      }
    }

    // Method 2: Legacy execCommand fallback
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        antMessage.success(`${label} copied: ${text}`);
        return;
      }
    } catch (err) {
      console.error('execCommand failed:', err);
    }

    // Method 3: Show in modal as last resort
    antMessage.info({
      content: (
        <div>
          <strong>{label}:</strong>
          <div style={{ 
            marginTop: '8px', 
            padding: '8px', 
            background: '#1a1a1a', 
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ff6b35',
            userSelect: 'all',
            cursor: 'text'
          }}>
            {text}
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#888' }}>
            Select the text above and press Ctrl+C (or Cmd+C on Mac)
          </div>
        </div>
      ),
      duration: 8
    });
  };

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
            {/* Summary Stats */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <ApiOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{ipAddresses.length}</div>
                  <div className={styles.summaryLabel}>Total Addresses</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CheckCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{ipAddresses.filter(a => !a.dynamic).length}</div>
                  <div className={styles.summaryLabel}>Static</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CloseCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{ipAddresses.filter(a => a.dynamic).length}</div>
                  <div className={styles.summaryLabel}>Dynamic</div>
                </div>
              </div>
            </div>

            {/* IP Addresses Table */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>IP Addresses</h2>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Address</div>
                  <div className={styles.tableCell}>Network</div>
                  <div className={styles.tableCell}>Interface</div>
                  <div className={styles.tableCell}>Type</div>
                  <div className={styles.tableCell}>Comment</div>
                </div>
                {ipAddresses.map((addr) => (
                  <div key={addr.id} className={styles.tableRow}>
                    <div className={styles.tableCell}>
                      <span 
                        className={`${styles.monospace} ${styles.copyable}`}
                        onClick={() => handleCopyToClipboard(addr.address, 'Address')}
                        title="Click to copy"
                      >
                        {addr.address}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span 
                        className={`${styles.monospace} ${styles.copyable}`}
                        onClick={() => handleCopyToClipboard(addr.network, 'Network')}
                        title="Click to copy"
                      >
                        {addr.network}
                      </span>
                    </div>
                    <div 
                      className={`${styles.tableCell} ${styles.copyable}`}
                      onClick={() => handleCopyToClipboard(addr.interface, 'Interface')}
                      title="Click to copy"
                    >
                      {addr.interface}
                    </div>
                    <div className={styles.tableCell}>
                      {addr.dynamic ? (
                        <span className={`${styles.badge} ${styles.badgeWarning}`}>
                          <ReloadOutlined className={styles.badgeIcon} />
                          Dynamic
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeInfo}`}>
                          Static
                        </span>
                      )}
                    </div>
                    <div 
                      className={`${styles.tableCell} ${addr.comment ? styles.copyable : ''}`}
                      onClick={() => addr.comment && handleCopyToClipboard(addr.comment, 'Comment')}
                      title={addr.comment ? 'Click to copy' : ''}
                    >
                      <span className={styles.commentText}>{addr.comment || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'routes':
        return (
          <div className={styles.content}>
            {/* Summary Stats */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <ApiOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{routes.length}</div>
                  <div className={styles.summaryLabel}>Total Routes</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CheckCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{routes.filter(r => r.active).length}</div>
                  <div className={styles.summaryLabel}>Active</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CloseCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{routes.filter(r => r.static).length}</div>
                  <div className={styles.summaryLabel}>Static</div>
                </div>
              </div>
            </div>

            {/* Routes Table */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Routing Table</h2>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Destination</div>
                  <div className={styles.tableCell}>Gateway</div>
                  <div className={styles.tableCell}>Interface</div>
                  <div className={styles.tableCell}>Distance</div>
                  <div className={styles.tableCell}>Status</div>
                  <div className={styles.tableCell}>Type</div>
                  <div className={styles.tableCell}>Comment</div>
                </div>
                {routes.map((route) => (
                  <div key={route.id} className={styles.tableRow}>
                    <div className={styles.tableCell}>
                      <span 
                        className={`${styles.monospace} ${styles.copyable}`}
                        onClick={() => handleCopyToClipboard(route.dstAddress, 'Destination')}
                        title="Click to copy"
                      >
                        {route.dstAddress}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span 
                        className={`${styles.monospace} ${styles.copyable}`}
                        onClick={() => handleCopyToClipboard(route.gateway, 'Gateway')}
                        title="Click to copy"
                      >
                        {route.gateway}
                      </span>
                      {route.gatewayStatus === 'reachable' && (
                        <CheckCircleOutlined className={styles.statusIconGood} />
                      )}
                      {route.gatewayStatus === 'unreachable' && (
                        <CloseCircleOutlined className={styles.statusIconBad} />
                      )}
                    </div>
                    <div 
                      className={`${styles.tableCell} ${route.interface ? styles.copyable : ''}`}
                      onClick={() => route.interface && handleCopyToClipboard(route.interface, 'Interface')}
                      title={route.interface ? 'Click to copy' : ''}
                    >
                      {route.interface || '—'}
                    </div>
                    <div className={styles.tableCell}>{route.distance}</div>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${route.active ? styles.badgeSuccess : styles.badgeDefault}`}>
                        {route.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${route.static ? styles.badgeInfo : styles.badgeWarning}`}>
                        {route.static ? 'Static' : 'Dynamic'}
                      </span>
                    </div>
                    <div 
                      className={`${styles.tableCell} ${route.comment ? styles.copyable : ''}`}
                      onClick={() => route.comment && handleCopyToClipboard(route.comment, 'Comment')}
                      title={route.comment ? 'Click to copy' : ''}
                    >
                      <span className={styles.commentText}>{route.comment || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'arp':
        return (
          <div className={styles.content}>
            {/* Summary Stats */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <ApiOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{arpEntries.length}</div>
                  <div className={styles.summaryLabel}>Total Entries</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CheckCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{arpEntries.filter(a => a.status === 'reachable').length}</div>
                  <div className={styles.summaryLabel}>Reachable</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CloseCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{arpEntries.filter(a => a.dynamic).length}</div>
                  <div className={styles.summaryLabel}>Dynamic</div>
                </div>
              </div>
            </div>

            {/* ARP Table */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>ARP Cache</h2>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>IP Address</div>
                  <div className={styles.tableCell}>MAC Address</div>
                  <div className={styles.tableCell}>Interface</div>
                  <div className={styles.tableCell}>Status</div>
                  <div className={styles.tableCell}>Type</div>
                  <div className={styles.tableCell}>DHCP</div>
                  <div className={styles.tableCell}>Comment</div>
                </div>
                {arpEntries.map((entry) => (
                  <div key={entry.id} className={styles.tableRow}>
                    <div className={styles.tableCell}>
                      <span 
                        className={`${styles.monospace} ${styles.copyable}`}
                        onClick={() => handleCopyToClipboard(entry.address, 'IP Address')}
                        title="Click to copy"
                      >
                        {entry.address}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span 
                        className={`${styles.monospace} ${styles.copyable}`}
                        onClick={() => handleCopyToClipboard(entry.macAddress, 'MAC Address')}
                        title="Click to copy"
                      >
                        {entry.macAddress}
                      </span>
                    </div>
                    <div 
                      className={`${styles.tableCell} ${styles.copyable}`}
                      onClick={() => handleCopyToClipboard(entry.interface, 'Interface')}
                      title="Click to copy"
                    >
                      {entry.interface}
                    </div>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${
                        entry.status === 'reachable' ? styles.badgeSuccess :
                        entry.status === 'stale' ? styles.badgeWarning :
                        styles.badgeDefault
                      }`}>
                        {entry.status}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${entry.dynamic ? styles.badgeWarning : styles.badgeInfo}`}>
                        {entry.dynamic ? 'Dynamic' : 'Static'}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      {entry.dhcp ? (
                        <CheckCircleOutlined className={styles.statusIconGood} />
                      ) : (
                        <span className={styles.textMuted}>—</span>
                      )}
                    </div>
                    <div 
                      className={`${styles.tableCell} ${entry.comment ? styles.copyable : ''}`}
                      onClick={() => entry.comment && handleCopyToClipboard(entry.comment, 'Comment')}
                      title={entry.comment ? 'Click to copy' : ''}
                    >
                      <span className={styles.commentText}>{entry.comment || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
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
        <button className={styles.refreshButton} onClick={fetchData}>
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
