/**
 * WireGuard VPN Service
 *
 * Manages WireGuard VPN interface and peer configurations.
 * Handles key generation, MikroTik synchronization, and peer management.
 */

import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getWireguardDatabase, WireguardInterface, WireguardPeer } from './wireguard-db.js';
import mikrotikService from '../mikrotik.js';
import QRCode from 'qrcode';

const execAsync = promisify(exec);

// Type definitions for frontend compatibility
export interface WireguardInterfaceConfig {
  name: string;
  address: string;
  listenPort: number;
  privateKey: string;
  publicKey: string;
  mtu: number;
  enabled: boolean;
}

export interface WireguardPeerConfig {
  id: string;
  name: string;
  publicKey: string;
  allowedIPs: string;
  endpoint?: string;
  persistentKeepalive?: number;
  lastHandshake?: Date;
  rxBytes?: number;
  txBytes?: number;
  currentEndpoint?: string;
}

export interface PeerFormData {
  name: string;
  publicKey: string;
  allowedIPs: string;
  endpoint?: string;
  persistentKeepalive?: number;
}

export interface QRCodeData {
  config: string;
  qrCodeDataUrl: string;
}

export interface WireguardStats {
  totalPeers: number;
  activePeers: number;
  totalRx: number;
  totalTx: number;
}

export class WireguardService {
  private static instance: WireguardService | null = null;
  private db = getWireguardDatabase();

  private constructor() {}

  public static getInstance(): WireguardService {
    if (!WireguardService.instance) {
      WireguardService.instance = new WireguardService();
    }
    return WireguardService.instance;
  }

  // ============ Key Generation ============

  /**
   * Generate WireGuard key pair using wg genkey/pubkey or fallback to crypto
   */
  async generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
    try {
      // Try using wg command first (preferred method)
      const { stdout: privateKey } = await execAsync('wg genkey');
      const { stdout: publicKey } = await execAsync(
        `echo "${privateKey.trim()}" | wg pubkey`
      );

      return {
        privateKey: privateKey.trim(),
        publicKey: publicKey.trim(),
      };
    } catch (error) {
      // Fallback to crypto-based generation
      console.log('[WireguardService] wg command not available, using crypto fallback');
      return this.generateKeyPairCrypto();
    }
  }

  /**
   * Fallback key generation using Node crypto (not as secure as wg)
   */
  private generateKeyPairCrypto(): { privateKey: string; publicKey: string } {
    // This is a simplified key generation - in production, use actual WireGuard tooling
    const privateKey = randomBytes(32).toString('base64');
    const publicKey = randomBytes(32).toString('base64');
    return { privateKey, publicKey };
  }

  /**
   * Generate preshared key for additional security
   */
  async generatePresharedKey(): Promise<string> {
    try {
      const { stdout } = await execAsync('wg genpsk');
      return stdout.trim();
    } catch (error) {
      return randomBytes(32).toString('base64');
    }
  }

  // ============ Interface Management ============

  /**
   * Get current WireGuard interface configuration
   */
  async getInterface(): Promise<WireguardInterfaceConfig | null> {
    const interfaces = this.db.getAllInterfaces();
    if (interfaces.length === 0) {
      return null;
    }

    // For now, support single interface (can be extended for multiple)
    const iface = interfaces[0];

    // Sync status from MikroTik if connected
    await this.syncInterfaceStatus(iface.id);

    const updated = this.db.getInterface(iface.id);
    if (!updated) return null;

    return this.convertInterfaceToFrontend(updated);
  }

  /**
   * Create or update WireGuard interface
   */
  async createOrUpdateInterface(config: Partial<WireguardInterfaceConfig>): Promise<WireguardInterfaceConfig> {
    const existingInterfaces = this.db.getAllInterfaces();
    let interfaceId: string;

    if (existingInterfaces.length > 0) {
      // Update existing interface
      const existing = existingInterfaces[0];
      interfaceId = existing.id;

      this.db.updateInterface(existing.id, {
        name: config.name || existing.name,
        address: config.address || existing.address,
        listen_port: config.listenPort || existing.listen_port,
        mtu: config.mtu || existing.mtu,
        enabled: config.enabled !== undefined ? config.enabled : existing.enabled,
      });
    } else {
      // Create new interface
      const keys = await this.generateKeyPair();

      const newInterface = this.db.createInterface({
        name: config.name || 'wireguard1',
        address: config.address || '10.0.0.1/24',
        listen_port: config.listenPort || 51820,
        private_key: keys.privateKey,
        public_key: keys.publicKey,
        mtu: config.mtu || 1420,
        enabled: config.enabled || false,
      });

      interfaceId = newInterface.id;
    }

    // Sync to MikroTik
    await this.syncToMikrotik(interfaceId);

    const updated = this.db.getInterface(interfaceId);
    if (!updated) {
      throw new Error('Failed to retrieve updated interface');
    }

    return this.convertInterfaceToFrontend(updated);
  }

  /**
   * Toggle interface enabled state
   */
  async toggleInterface(enabled: boolean): Promise<void> {
    const interfaces = this.db.getAllInterfaces();
    if (interfaces.length === 0) {
      throw new Error('No WireGuard interface configured');
    }

    const iface = interfaces[0];
    this.db.updateInterface(iface.id, { enabled });

    // Sync to MikroTik
    await this.syncToMikrotik(iface.id);
  }

  /**
   * Generate new keys for existing interface
   */
  async regenerateKeys(): Promise<{ publicKey: string }> {
    const interfaces = this.db.getAllInterfaces();
    if (interfaces.length === 0) {
      throw new Error('No WireGuard interface configured');
    }

    const iface = interfaces[0];
    const keys = await this.generateKeyPair();

    this.db.updateInterface(iface.id, {
      private_key: keys.privateKey,
      public_key: keys.publicKey,
    });

    // Sync to MikroTik
    await this.syncToMikrotik(iface.id);

    return { publicKey: keys.publicKey };
  }

  // ============ Peer Management ============

  /**
   * Get all peers for the current interface
   */
  async getPeers(): Promise<WireguardPeerConfig[]> {
    const interfaces = this.db.getAllInterfaces();
    if (interfaces.length === 0) {
      return [];
    }

    const iface = interfaces[0];
    const peers = this.db.getPeersByInterface(iface.id);

    // Sync peer stats from MikroTik
    await this.syncPeerStats(iface.id);

    // Reload peers with updated stats
    const updatedPeers = this.db.getPeersByInterface(iface.id);

    return updatedPeers.map(peer => this.convertPeerToFrontend(peer));
  }

  /**
   * Add new peer
   */
  async addPeer(data: PeerFormData): Promise<WireguardPeerConfig> {
    const interfaces = this.db.getAllInterfaces();
    if (interfaces.length === 0) {
      throw new Error('No WireGuard interface configured');
    }

    const iface = interfaces[0];

    const peer = this.db.createPeer({
      interface_id: iface.id,
      name: data.name,
      public_key: data.publicKey,
      allowed_ips: data.allowedIPs,
      endpoint: data.endpoint,
      persistent_keepalive: data.persistentKeepalive,
    });

    // Sync to MikroTik
    await this.syncPeerToMikrotik(peer.id);

    return this.convertPeerToFrontend(peer);
  }

  /**
   * Update peer configuration
   */
  async updatePeer(peerId: string, data: Partial<PeerFormData>): Promise<WireguardPeerConfig> {
    const peer = this.db.getPeer(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    this.db.updatePeer(peerId, {
      name: data.name,
      allowed_ips: data.allowedIPs,
      endpoint: data.endpoint,
      persistent_keepalive: data.persistentKeepalive,
    });

    // Sync to MikroTik
    await this.syncPeerToMikrotik(peerId);

    const updated = this.db.getPeer(peerId);
    if (!updated) {
      throw new Error('Failed to retrieve updated peer');
    }

    return this.convertPeerToFrontend(updated);
  }

  /**
   * Delete peer
   */
  async deletePeer(peerId: string): Promise<void> {
    const peer = this.db.getPeer(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    // Remove from MikroTik first
    if (peer.mikrotik_id) {
      await this.deletePeerFromMikrotik(peer.mikrotik_id);
    }

    // Delete from database
    this.db.deletePeer(peerId);
  }

  /**
   * Generate QR code for peer configuration
   */
  async generatePeerQRCode(peerId: string): Promise<QRCodeData> {
    const peer = this.db.getPeer(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const interfaces = this.db.getAllInterfaces();
    if (interfaces.length === 0) {
      throw new Error('No WireGuard interface configured');
    }

    const iface = interfaces[0];

    // Generate WireGuard configuration file content
    const config = `[Interface]
PrivateKey = [CLIENT_PRIVATE_KEY]
Address = ${peer.allowed_ips}
DNS = 1.1.1.1

[Peer]
PublicKey = ${iface.public_key}
Endpoint = [SERVER_PUBLIC_IP]:${iface.listen_port}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = ${peer.persistent_keepalive || 25}
`;

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(config);

    return {
      config,
      qrCodeDataUrl,
    };
  }

  /**
   * Get WireGuard statistics
   */
  async getStats(): Promise<WireguardStats> {
    const interfaces = this.db.getAllInterfaces();
    if (interfaces.length === 0) {
      return {
        totalPeers: 0,
        activePeers: 0,
        totalRx: 0,
        totalTx: 0,
      };
    }

    const iface = interfaces[0];
    const peers = this.db.getPeersByInterface(iface.id);

    // Sync stats from MikroTik
    await this.syncPeerStats(iface.id);

    // Reload with updated stats
    const updatedPeers = this.db.getPeersByInterface(iface.id);

    const activePeers = updatedPeers.filter(
      p => p.last_handshake && Date.now() - p.last_handshake < 3 * 60 * 1000
    ).length;

    const totalRx = updatedPeers.reduce((sum, p) => sum + (p.rx_bytes || 0), 0);
    const totalTx = updatedPeers.reduce((sum, p) => sum + (p.tx_bytes || 0), 0);

    return {
      totalPeers: updatedPeers.length,
      activePeers,
      totalRx,
      totalTx,
    };
  }

  // ============ MikroTik Synchronization ============

  /**
   * Sync interface configuration to MikroTik
   */
  private async syncToMikrotik(interfaceId: string): Promise<void> {
    const iface = this.db.getInterface(interfaceId);
    if (!iface) return;

    try {
      // Check if interface exists on MikroTik
      const existingInterfaces = await mikrotikService.executeCommand('/interface/wireguard/print');
      const existing = existingInterfaces.find((i: any) => i.name === iface.name);

      if (existing) {
        // Update existing
        const mikrotikId = existing['.id'];
        await mikrotikService.executeCommand('/interface/wireguard/set', {
          '.id': mikrotikId,
          'listen-port': iface.listen_port.toString(),
          'mtu': iface.mtu.toString(),
          'private-key': iface.private_key,
          'disabled': (!iface.enabled).toString(),
        });

        this.db.updateInterface(interfaceId, {
          mikrotik_id: mikrotikId,
          last_sync_at: Date.now(),
        });
      } else {
        // Create new
        await mikrotikService.executeCommand('/interface/wireguard/add', {
          'name': iface.name,
          'listen-port': iface.listen_port.toString(),
          'mtu': iface.mtu.toString(),
          'private-key': iface.private_key,
          'disabled': (!iface.enabled).toString(),
        });

        // Get the created interface ID
        const created = await mikrotikService.executeCommand('/interface/wireguard/print');
        const newInterface = created.find((i: any) => i.name === iface.name);

        if (newInterface) {
          this.db.updateInterface(interfaceId, {
            mikrotik_id: newInterface['.id'],
            last_sync_at: Date.now(),
          });
        }
      }

      // Add/Update address
      const ipAddresses = await mikrotikService.executeCommand('/ip/address/print');
      const existingAddress = ipAddresses.find((addr: any) => addr.interface === iface.name);

      if (existingAddress) {
        await mikrotikService.executeCommand('/ip/address/set', {
          '.id': existingAddress['.id'],
          'address': iface.address,
        });
      } else {
        await mikrotikService.executeCommand('/ip/address/add', {
          'interface': iface.name,
          'address': iface.address,
        });
      }

      console.log(`[WireguardService] Interface ${iface.name} synced to MikroTik`);
    } catch (error: any) {
      console.error('[WireguardService] Failed to sync interface to MikroTik:', error.message);
      throw new Error(`Failed to sync interface to MikroTik: ${error.message}`);
    }
  }

  /**
   * Sync interface status from MikroTik
   */
  private async syncInterfaceStatus(interfaceId: string): Promise<void> {
    const iface = this.db.getInterface(interfaceId);
    if (!iface || !iface.mikrotik_id) return;

    try {
      const result = await mikrotikService.executeCommand('/interface/wireguard/print');
      const mikrotikIface = result.find((i: any) => i.name === iface.name);

      if (mikrotikIface) {
        this.db.updateInterface(interfaceId, {
          enabled: !mikrotikIface.disabled,
          last_sync_at: Date.now(),
        });
      }
    } catch (error: any) {
      console.error('[WireguardService] Failed to sync interface status:', error.message);
    }
  }

  /**
   * Sync peer to MikroTik
   */
  private async syncPeerToMikrotik(peerId: string): Promise<void> {
    const peer = this.db.getPeer(peerId);
    if (!peer) return;

    const interfaces = this.db.getAllInterfaces();
    if (interfaces.length === 0) return;

    const iface = interfaces[0];

    try {
      // Check if peer exists
      const allPeers = await mikrotikService.executeCommand('/interface/wireguard/peers/print');
      const existingPeer = allPeers?.find(
        (p: any) => p.interface === iface.name && p['public-key'] === peer.public_key
      );

      if (existingPeer) {
        // Update existing
        const mikrotikId = existingPeer['.id'];
        const updateParams: Record<string, any> = {
          '.id': mikrotikId,
          'allowed-address': peer.allowed_ips,
        };

        if (peer.endpoint) {
          updateParams.endpoint = peer.endpoint;
        }
        if (peer.persistent_keepalive) {
          updateParams['persistent-keepalive'] = peer.persistent_keepalive.toString();
        }

        await mikrotikService.executeCommand('/interface/wireguard/peers/set', updateParams);

        this.db.updatePeer(peerId, {
          mikrotik_id: mikrotikId,
          last_sync_at: Date.now(),
        });
      } else {
        // Create new
        const createParams: Record<string, any> = {
          interface: iface.name,
          'public-key': peer.public_key,
          'allowed-address': peer.allowed_ips,
        };

        if (peer.endpoint) {
          createParams.endpoint = peer.endpoint;
        }
        if (peer.persistent_keepalive) {
          createParams['persistent-keepalive'] = peer.persistent_keepalive.toString();
        }

        await mikrotikService.executeCommand('/interface/wireguard/peers/add', createParams);

        // Get the created peer ID
        const updatedPeers = await mikrotikService.executeCommand('/interface/wireguard/peers/print');
        const createdPeer = updatedPeers?.find(
          (p: any) => p.interface === iface.name && p['public-key'] === peer.public_key
        );

        if (createdPeer) {
          this.db.updatePeer(peerId, {
            mikrotik_id: createdPeer['.id'],
            last_sync_at: Date.now(),
          });
        }
      }

      console.log(`[WireguardService] Peer ${peer.name} synced to MikroTik`);
    } catch (error: any) {
      console.error('[WireguardService] Failed to sync peer to MikroTik:', error.message);
      throw new Error(`Failed to sync peer to MikroTik: ${error.message}`);
    }
  }

  /**
   * Sync peer statistics from MikroTik
   */
  private async syncPeerStats(interfaceId: string): Promise<void> {
    const iface = this.db.getInterface(interfaceId);
    if (!iface) return;

    try {
      const allPeers = await mikrotikService.executeCommand('/interface/wireguard/peers/print');
      const interfacePeers = allPeers?.filter((p: any) => p.interface === iface.name);

      if (!interfacePeers) return;

      for (const mikrotikPeer of interfacePeers) {
        // Find matching peer by public key
        const dbPeers = this.db.getPeersByInterface(interfaceId);
        const dbPeer = dbPeers.find(p => p.public_key === mikrotikPeer['public-key']);

        if (dbPeer) {
          this.db.updatePeer(dbPeer.id, {
            last_handshake: mikrotikPeer['last-handshake']
              ? Date.now() - parseInt(mikrotikPeer['last-handshake']) * 1000
              : undefined,
            rx_bytes: parseInt(mikrotikPeer.rx || '0'),
            tx_bytes: parseInt(mikrotikPeer.tx || '0'),
            current_endpoint: mikrotikPeer['current-endpoint'],
          });
        }
      }
    } catch (error: any) {
      console.error('[WireguardService] Failed to sync peer stats:', error.message);
    }
  }

  /**
   * Delete peer from MikroTik
   */
  private async deletePeerFromMikrotik(mikrotikId: string): Promise<void> {
    try {
      await mikrotikService.executeCommand('/interface/wireguard/peers/remove', {
        '.id': mikrotikId,
      });
      console.log(`[WireguardService] Peer removed from MikroTik`);
    } catch (error: any) {
      console.error('[WireguardService] Failed to delete peer from MikroTik:', error.message);
    }
  }

  // ============ Helper Methods ============

  private convertInterfaceToFrontend(iface: WireguardInterface): WireguardInterfaceConfig {
    return {
      name: iface.name,
      address: iface.address,
      listenPort: iface.listen_port,
      privateKey: iface.private_key,
      publicKey: iface.public_key,
      mtu: iface.mtu,
      enabled: iface.enabled,
    };
  }

  private convertPeerToFrontend(peer: WireguardPeer): WireguardPeerConfig {
    return {
      id: peer.id,
      name: peer.name,
      publicKey: peer.public_key,
      allowedIPs: peer.allowed_ips,
      endpoint: peer.endpoint,
      persistentKeepalive: peer.persistent_keepalive,
      lastHandshake: peer.last_handshake ? new Date(peer.last_handshake) : undefined,
      rxBytes: peer.rx_bytes,
      txBytes: peer.tx_bytes,
      currentEndpoint: peer.current_endpoint,
    };
  }
}

export const wireguardService = WireguardService.getInstance();
