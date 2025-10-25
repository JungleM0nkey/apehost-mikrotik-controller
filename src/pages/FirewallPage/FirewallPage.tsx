import React, { useState, useEffect } from 'react';
import { Tabs, message as antMessage } from 'antd';
import {
  FireOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
  ApiOutlined,
  DownloadOutlined,
  CopyOutlined
} from '@ant-design/icons';
import api from '../../services/api';
import type {
  FirewallFilterRule,
  FirewallNatRule,
  FirewallMangleRule,
  FirewallAddressList
} from '../../types/api';
import styles from './FirewallPage.module.css';

export const FirewallPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('filter');
  const [filterRules, setFilterRules] = useState<FirewallFilterRule[]>([]);
  const [natRules, setNatRules] = useState<FirewallNatRule[]>([]);
  const [mangleRules, setMangleRules] = useState<FirewallMangleRule[]>([]);
  const [addressLists, setAddressLists] = useState<FirewallAddressList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFilterRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getFirewallFilterRules();
      setFilterRules(data);
    } catch (err) {
      console.error('Failed to fetch filter rules:', err);
      setError(err instanceof Error ? err.message : 'Failed to load filter rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchNatRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getFirewallNatRules();
      setNatRules(data);
    } catch (err) {
      console.error('Failed to fetch NAT rules:', err);
      setError(err instanceof Error ? err.message : 'Failed to load NAT rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchMangleRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getFirewallMangleRules();
      setMangleRules(data);
    } catch (err) {
      console.error('Failed to fetch mangle rules:', err);
      setError(err instanceof Error ? err.message : 'Failed to load mangle rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchAddressLists = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getFirewallAddressLists();
      setAddressLists(data);
    } catch (err) {
      console.error('Failed to fetch address lists:', err);
      setError(err instanceof Error ? err.message : 'Failed to load address lists');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = () => {
    switch (activeTab) {
      case 'filter':
        fetchFilterRules();
        break;
      case 'nat':
        fetchNatRules();
        break;
      case 'mangle':
        fetchMangleRules();
        break;
      case 'address-list':
        fetchAddressLists();
        break;
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, [activeTab]);

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

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getCurrentTabData = () => {
    switch (activeTab) {
      case 'filter':
        return { type: 'Filter Rules', data: filterRules };
      case 'nat':
        return { type: 'NAT Rules', data: natRules };
      case 'mangle':
        return { type: 'Mangle Rules', data: mangleRules };
      case 'address-list':
        return { type: 'Address Lists', data: addressLists };
      default:
        return { type: 'Unknown', data: [] };
    }
  };

  const handleExportRules = () => {
    const { type, data } = getCurrentTabData();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `firewall-${activeTab}-${timestamp}.json`;

    const exportData = {
      exported: new Date().toISOString(),
      type,
      count: data.length,
      rules: data
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    antMessage.success(`Exported ${data.length} ${type.toLowerCase()} to ${filename}`);
  };

  const handleCopyCurrentTab = async () => {
    const { type, data } = getCurrentTabData();

    const exportData = {
      exported: new Date().toISOString(),
      type,
      count: data.length,
      rules: data
    };

    const text = JSON.stringify(exportData, null, 2);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        antMessage.success(`Copied ${data.length} ${type.toLowerCase()} to clipboard`);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        antMessage.success(`Copied ${data.length} ${type.toLowerCase()} to clipboard`);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      antMessage.error('Failed to copy to clipboard');
    }
  };

  const renderContent = () => {
    if (loading && filterRules.length === 0 && natRules.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.spinner} />
          <p>Loading firewall configuration...</p>
        </div>
      );
    }

    if (error && filterRules.length === 0 && natRules.length === 0) {
      return (
        <div className={styles.emptyState}>
          <WarningOutlined className={styles.errorIcon} />
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryButton} onClick={fetchData}>
            Retry
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'filter':
        return (
          <div className={styles.content}>
            {/* Summary Stats */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <ApiOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{filterRules.length}</div>
                  <div className={styles.summaryLabel}>Total Rules</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CheckCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{filterRules.filter(r => !r.disabled).length}</div>
                  <div className={styles.summaryLabel}>Active</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CloseCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{filterRules.filter(r => r.action === 'drop' || r.action === 'reject').length}</div>
                  <div className={styles.summaryLabel}>Drop/Reject</div>
                </div>
              </div>
            </div>

            {/* Filter Rules Table */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Filter Rules</h2>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Chain</div>
                  <div className={styles.tableCell}>Action</div>
                  <div className={styles.tableCell}>Protocol</div>
                  <div className={styles.tableCell}>Source</div>
                  <div className={styles.tableCell}>Destination</div>
                  <div className={styles.tableCell}>Interface</div>
                  <div className={styles.tableCell}>Traffic</div>
                  <div className={styles.tableCell}>Comment</div>
                </div>
                {filterRules.map((rule) => (
                  <div key={rule.id} className={`${styles.tableRow} ${rule.disabled ? styles.disabled : ''}`}>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>
                        {rule.chain}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${
                        rule.action === 'accept' ? styles.badgeSuccess :
                        rule.action === 'drop' || rule.action === 'reject' ? styles.badgeDanger :
                        styles.badgeWarning
                      }`}>
                        {rule.action}
                      </span>
                    </div>
                    <div className={styles.tableCell}>{rule.protocol || '—'}</div>
                    <div className={styles.tableCell}>
                      {rule.srcAddress ? (
                        <span
                          className={`${styles.monospace} ${styles.copyable}`}
                          onClick={() => handleCopyToClipboard(rule.srcAddress!, 'Source Address')}
                          title="Click to copy"
                        >
                          {rule.srcAddress}
                        </span>
                      ) : '—'}
                      {rule.srcPort && <div className={styles.portText}>:{rule.srcPort}</div>}
                    </div>
                    <div className={styles.tableCell}>
                      {rule.dstAddress ? (
                        <span
                          className={`${styles.monospace} ${styles.copyable}`}
                          onClick={() => handleCopyToClipboard(rule.dstAddress!, 'Destination Address')}
                          title="Click to copy"
                        >
                          {rule.dstAddress}
                        </span>
                      ) : '—'}
                      {rule.dstPort && <div className={styles.portText}>:{rule.dstPort}</div>}
                    </div>
                    <div className={styles.tableCell}>
                      {rule.inInterface && <div>In: {rule.inInterface}</div>}
                      {rule.outInterface && <div>Out: {rule.outInterface}</div>}
                      {!rule.inInterface && !rule.outInterface && '—'}
                    </div>
                    <div className={styles.tableCell}>
                      <div>{formatBytes(rule.bytes || 0)}</div>
                      <div className={styles.textMuted}>{rule.packets || 0} pkts</div>
                    </div>
                    <div
                      className={`${styles.tableCell} ${rule.comment ? styles.copyable : ''}`}
                      onClick={() => rule.comment && handleCopyToClipboard(rule.comment, 'Comment')}
                      title={rule.comment ? 'Click to copy' : ''}
                    >
                      <span className={styles.commentText}>{rule.comment || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'nat':
        return (
          <div className={styles.content}>
            {/* Summary Stats */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <ApiOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{natRules.length}</div>
                  <div className={styles.summaryLabel}>Total Rules</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CheckCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{natRules.filter(r => r.chain === 'srcnat').length}</div>
                  <div className={styles.summaryLabel}>Source NAT</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CloseCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{natRules.filter(r => r.chain === 'dstnat').length}</div>
                  <div className={styles.summaryLabel}>Destination NAT</div>
                </div>
              </div>
            </div>

            {/* NAT Rules Table */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>NAT Rules</h2>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Chain</div>
                  <div className={styles.tableCell}>Action</div>
                  <div className={styles.tableCell}>Protocol</div>
                  <div className={styles.tableCell}>Source</div>
                  <div className={styles.tableCell}>Destination</div>
                  <div className={styles.tableCell}>Translation</div>
                  <div className={styles.tableCell}>Traffic</div>
                  <div className={styles.tableCell}>Comment</div>
                </div>
                {natRules.map((rule) => (
                  <div key={rule.id} className={`${styles.tableRow} ${rule.disabled ? styles.disabled : ''}`}>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>
                        {rule.chain}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                        {rule.action}
                      </span>
                    </div>
                    <div className={styles.tableCell}>{rule.protocol || '—'}</div>
                    <div className={styles.tableCell}>
                      {rule.srcAddress ? (
                        <span
                          className={`${styles.monospace} ${styles.copyable}`}
                          onClick={() => handleCopyToClipboard(rule.srcAddress!, 'Source Address')}
                          title="Click to copy"
                        >
                          {rule.srcAddress}
                        </span>
                      ) : '—'}
                      {rule.srcPort && <div className={styles.portText}>:{rule.srcPort}</div>}
                    </div>
                    <div className={styles.tableCell}>
                      {rule.dstAddress ? (
                        <span
                          className={`${styles.monospace} ${styles.copyable}`}
                          onClick={() => handleCopyToClipboard(rule.dstAddress!, 'Destination Address')}
                          title="Click to copy"
                        >
                          {rule.dstAddress}
                        </span>
                      ) : '—'}
                      {rule.dstPort && <div className={styles.portText}>:{rule.dstPort}</div>}
                    </div>
                    <div className={styles.tableCell}>
                      {rule.toAddresses && <div>→ {rule.toAddresses}</div>}
                      {rule.toPorts && <div className={styles.portText}>:{rule.toPorts}</div>}
                      {!rule.toAddresses && !rule.toPorts && '—'}
                    </div>
                    <div className={styles.tableCell}>
                      <div>{formatBytes(rule.bytes || 0)}</div>
                      <div className={styles.textMuted}>{rule.packets || 0} pkts</div>
                    </div>
                    <div
                      className={`${styles.tableCell} ${rule.comment ? styles.copyable : ''}`}
                      onClick={() => rule.comment && handleCopyToClipboard(rule.comment, 'Comment')}
                      title={rule.comment ? 'Click to copy' : ''}
                    >
                      <span className={styles.commentText}>{rule.comment || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'mangle':
        return (
          <div className={styles.content}>
            {/* Summary Stats */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <ApiOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{mangleRules.length}</div>
                  <div className={styles.summaryLabel}>Total Rules</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CheckCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{mangleRules.filter(r => !r.disabled).length}</div>
                  <div className={styles.summaryLabel}>Active</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CloseCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{mangleRules.filter(r => r.passthroughEnabled).length}</div>
                  <div className={styles.summaryLabel}>Passthrough</div>
                </div>
              </div>
            </div>

            {/* Mangle Rules Table */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Mangle Rules</h2>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Chain</div>
                  <div className={styles.tableCell}>Action</div>
                  <div className={styles.tableCell}>Protocol</div>
                  <div className={styles.tableCell}>Source</div>
                  <div className={styles.tableCell}>Destination</div>
                  <div className={styles.tableCell}>Marks</div>
                  <div className={styles.tableCell}>Traffic</div>
                  <div className={styles.tableCell}>Comment</div>
                </div>
                {mangleRules.map((rule) => (
                  <div key={rule.id} className={`${styles.tableRow} ${rule.disabled ? styles.disabled : ''}`}>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>
                        {rule.chain}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>
                        {rule.action}
                      </span>
                    </div>
                    <div className={styles.tableCell}>{rule.protocol || '—'}</div>
                    <div className={styles.tableCell}>
                      {rule.srcAddress ? (
                        <span
                          className={`${styles.monospace} ${styles.copyable}`}
                          onClick={() => handleCopyToClipboard(rule.srcAddress!, 'Source Address')}
                          title="Click to copy"
                        >
                          {rule.srcAddress}
                        </span>
                      ) : '—'}
                    </div>
                    <div className={styles.tableCell}>
                      {rule.dstAddress ? (
                        <span
                          className={`${styles.monospace} ${styles.copyable}`}
                          onClick={() => handleCopyToClipboard(rule.dstAddress!, 'Destination Address')}
                          title="Click to copy"
                        >
                          {rule.dstAddress}
                        </span>
                      ) : '—'}
                    </div>
                    <div className={styles.tableCell}>
                      {rule.newRoutingMark && <div>Routing: {rule.newRoutingMark}</div>}
                      {rule.newPacketMark && <div>Packet: {rule.newPacketMark}</div>}
                      {!rule.newRoutingMark && !rule.newPacketMark && '—'}
                    </div>
                    <div className={styles.tableCell}>
                      <div>{formatBytes(rule.bytes || 0)}</div>
                      <div className={styles.textMuted}>{rule.packets || 0} pkts</div>
                    </div>
                    <div
                      className={`${styles.tableCell} ${rule.comment ? styles.copyable : ''}`}
                      onClick={() => rule.comment && handleCopyToClipboard(rule.comment, 'Comment')}
                      title={rule.comment ? 'Click to copy' : ''}
                    >
                      <span className={styles.commentText}>{rule.comment || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'address-list':
        return (
          <div className={styles.content}>
            {/* Summary Stats */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <ApiOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{addressLists.length}</div>
                  <div className={styles.summaryLabel}>Total Entries</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CheckCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{[...new Set(addressLists.map(a => a.list))].length}</div>
                  <div className={styles.summaryLabel}>Unique Lists</div>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <CloseCircleOutlined className={styles.summaryIcon} />
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{addressLists.filter(a => a.dynamic).length}</div>
                  <div className={styles.summaryLabel}>Dynamic</div>
                </div>
              </div>
            </div>

            {/* Address Lists Table */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Address Lists</h2>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>List Name</div>
                  <div className={styles.tableCell}>Address</div>
                  <div className={styles.tableCell}>Type</div>
                  <div className={styles.tableCell}>Creation Time</div>
                  <div className={styles.tableCell}>Timeout</div>
                  <div className={styles.tableCell}>Comment</div>
                </div>
                {addressLists.map((entry) => (
                  <div key={entry.id} className={`${styles.tableRow} ${entry.disabled ? styles.disabled : ''}`}>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>
                        {entry.list}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span
                        className={`${styles.monospace} ${styles.copyable}`}
                        onClick={() => handleCopyToClipboard(entry.address, 'Address')}
                        title="Click to copy"
                      >
                        {entry.address}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      <span className={`${styles.badge} ${entry.dynamic ? styles.badgeWarning : styles.badgeSuccess}`}>
                        {entry.dynamic ? 'Dynamic' : 'Static'}
                      </span>
                    </div>
                    <div className={styles.tableCell}>{entry.creationTime || '—'}</div>
                    <div className={styles.tableCell}>{entry.timeout || '—'}</div>
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
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <FireOutlined className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Firewall</h1>
            <p className={styles.subtitle}>Manage firewall rules and security policies</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshButton} onClick={handleCopyCurrentTab}>
            <CopyOutlined className={styles.refreshIcon} />
            Copy
          </button>
          <button className={styles.refreshButton} onClick={handleExportRules}>
            <DownloadOutlined className={styles.refreshIcon} />
            Export
          </button>
          <button className={styles.refreshButton} onClick={fetchData}>
            <ReloadOutlined className={styles.refreshIcon} />
            Refresh
          </button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'filter',
            label: 'Filter Rules'
          },
          {
            key: 'nat',
            label: 'NAT Rules'
          },
          {
            key: 'mangle',
            label: 'Mangle Rules'
          },
          {
            key: 'address-list',
            label: 'Address Lists'
          }
        ]}
      />

      {renderContent()}
    </div>
  );
};
