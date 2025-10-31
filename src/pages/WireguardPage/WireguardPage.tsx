import React, { useState, useEffect } from 'react';
import { Alert, Button, message } from 'antd';
import { PlusOutlined, ReloadOutlined, LockOutlined } from '@ant-design/icons';
import { SettingsSection } from '../../components/organisms/SettingsSection/SettingsSection';
import { FormField } from '../../components/molecules/FormField/FormField';
import { ToggleField } from '../../components/molecules/ToggleField/ToggleField';
import { Input } from '../../components/atoms/Input/Input';
import { Button as CustomButton } from '../../components/atoms/Button/Button';
import type { WireguardInterface, WireguardPeer } from '../../types/wireguard';
import styles from './WireguardPage.module.css';

export const WireguardPage: React.FC = () => {
  const [interfaceConfig, setInterfaceConfig] = useState<WireguardInterface | null>(null);
  const [peers, setPeers] = useState<WireguardPeer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('wireguard1');
  const [address, setAddress] = useState('10.0.0.1/24');
  const [listenPort, setListenPort] = useState(51820);
  const [mtu, setMtu] = useState(1420);
  const [enabled, setEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState('');

  // UI state
  // Note: Modal implementation pending - state kept for future use
  const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
  void isPeerModalOpen; // Suppress unused variable warning - will be used when modal is implemented
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchInterfaceConfig();
    fetchPeers();
  }, []);

  const fetchInterfaceConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/wireguard/interface');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setInterfaceConfig(data);
          setName(data.name);
          setAddress(data.address);
          setListenPort(data.listenPort);
          setMtu(data.mtu);
          setEnabled(data.enabled);
          setPublicKey(data.publicKey);
        }
      }
    } catch (err) {
      setError('Failed to load Wireguard configuration');
      console.error('[WireguardPage] Error fetching config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPeers = async () => {
    try {
      const response = await fetch('/api/wireguard/peers');
      if (response.ok) {
        const data = await response.json();
        setPeers(data);
      }
    } catch (err) {
      console.error('[WireguardPage] Error fetching peers:', err);
    }
  };

  const handleGenerateKeys = async () => {
    try {
      const response = await fetch('/api/wireguard/interface/generate-keys', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setPublicKey(data.publicKey);
        setHasChanges(true);
        message.success('New keys generated');
      }
    } catch (err) {
      message.error('Failed to generate keys');
      console.error('[WireguardPage] Error generating keys:', err);
    }
  };

  const handleSaveInterface = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/wireguard/interface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address,
          listenPort,
          mtu,
          enabled,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInterfaceConfig(data);
        setPublicKey(data.publicKey);
        setHasChanges(false);
        message.success('Interface configuration saved');
      } else {
        message.error('Failed to save configuration');
      }
    } catch (err) {
      message.error('Failed to save configuration');
      console.error('[WireguardPage] Error saving config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleInterface = async (newEnabled: boolean) => {
    try {
      const response = await fetch('/api/wireguard/interface/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });

      if (response.ok) {
        setEnabled(newEnabled);
        message.success(`Interface ${newEnabled ? 'enabled' : 'disabled'}`);
      } else {
        message.error('Failed to toggle interface');
      }
    } catch (err) {
      message.error('Failed to toggle interface');
      console.error('[WireguardPage] Error toggling interface:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading Wireguard configuration...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Wireguard VPN</h1>
        <div className={styles.headerActions}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchInterfaceConfig();
              fetchPeers();
            }}
          >
            Refresh
          </Button>
        </div>
      </header>

      <div className={styles.content}>
        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Interface Configuration Section */}
        <SettingsSection
          title="Interface Configuration"
          description="Configure your Wireguard VPN server"
        >
          <ToggleField
            label="Enable Interface"
            description="Enable or disable the Wireguard interface"
            checked={enabled}
            onChange={handleToggleInterface}
          />

          <FormField
            label="Interface Name"
            helpText="Name for the Wireguard interface"
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="wireguard1"
              disabled={isSaving}
            />
          </FormField>

          <FormField
            label="Interface Address"
            helpText="Private IP address range for VPN (CIDR notation)"
          >
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="10.0.0.1/24"
              disabled={isSaving}
            />
          </FormField>

          <div className={styles.gridTwo}>
            <FormField
              label="Listen Port"
              helpText="UDP port for Wireguard connections"
            >
              <Input
                type="number"
                value={listenPort.toString()}
                onChange={(e) => setListenPort(parseInt(e.target.value) || 51820)}
                placeholder="51820"
                disabled={isSaving}
              />
            </FormField>

            <FormField
              label="MTU"
              helpText="Maximum transmission unit"
            >
              <Input
                type="number"
                value={mtu.toString()}
                onChange={(e) => setMtu(parseInt(e.target.value) || 1420)}
                placeholder="1420"
                disabled={isSaving}
              />
            </FormField>
          </div>

          <FormField
            label="Public Key"
            helpText="Your server's public key (share this with peers)"
          >
            <div className={styles.keyField}>
              <Input
                value={publicKey || 'Not generated yet'}
                onChange={() => {}}
                disabled
                className={styles.keyInput}
              />
              <Button
                onClick={() => copyToClipboard(publicKey)}
                disabled={!publicKey}
              >
                Copy
              </Button>
            </div>
          </FormField>

          <div className={styles.actions}>
            <CustomButton
              variant="secondary"
              onClick={handleGenerateKeys}
              disabled={isSaving}
            >
              Generate New Keys
            </CustomButton>
            <CustomButton
              variant="primary"
              onClick={handleSaveInterface}
              disabled={isSaving || !hasChanges}
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </CustomButton>
          </div>
        </SettingsSection>

        {/* Peers Section */}
        <SettingsSection
          title="VPN Peers"
          description="Manage VPN clients and their access"
        >
          <div className={styles.peersHeader}>
            <div>
              <p className={styles.peersCount}>
                {peers.length} {peers.length === 1 ? 'peer' : 'peers'} configured
              </p>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsPeerModalOpen(true)}
              disabled={!interfaceConfig}
            >
              Add Peer
            </Button>
          </div>

          {peers.length === 0 ? (
            <div className={styles.emptyState}>
              <LockOutlined className={styles.emptyIcon} />
              <h3>No peers configured</h3>
              <p>Add VPN clients to allow remote access to your network</p>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsPeerModalOpen(true)}
                disabled={!interfaceConfig}
              >
                Add First Peer
              </Button>
            </div>
          ) : (
            <div className={styles.peersList}>
              {peers.map((peer) => (
                <div key={peer.id} className={styles.peerCard}>
                  <div className={styles.peerHeader}>
                    <h4 className={styles.peerName}>{peer.name}</h4>
                    <span className={styles.peerStatus}>
                      {peer.lastHandshake ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className={styles.peerDetails}>
                    <div className={styles.peerDetail}>
                      <span>Public Key:</span>
                      <code>{peer.publicKey.slice(0, 20)}...</code>
                    </div>
                    <div className={styles.peerDetail}>
                      <span>Allowed IPs:</span>
                      <code>{peer.allowedIPs}</code>
                    </div>
                    {peer.lastHandshake && (
                      <div className={styles.peerDetail}>
                        <span>Last Handshake:</span>
                        <span>{new Date(peer.lastHandshake).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.peerActions}>
                    <Button size="small">Generate QR</Button>
                    <Button size="small">Edit</Button>
                    <Button size="small" danger>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      </div>
    </div>
  );
};
