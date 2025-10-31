/**
 * WireGuard VPN API Routes
 *
 * Provides REST API for WireGuard VPN interface and peer management.
 */

import { Router, Request, Response } from 'express';
import { wireguardService, PeerFormData } from '../services/wireguard/wireguard.service.js';

export const wireguardRoutes = Router();

// ============ Interface Management ============

/**
 * GET /api/wireguard/interface
 * Get current WireGuard interface configuration
 */
wireguardRoutes.get('/interface', async (req: Request, res: Response) => {
  try {
    const config = await wireguardService.getInterface();
    res.json(config);
  } catch (error: any) {
    console.error('[WireguardRoutes] Error getting interface:', error.message);
    res.status(500).json({
      error: 'Failed to get WireGuard interface',
      message: error.message,
    });
  }
});

/**
 * POST /api/wireguard/interface
 * Create or update WireGuard interface configuration
 */
wireguardRoutes.post('/interface', async (req: Request, res: Response) => {
  try {
    const { name, address, listenPort, mtu, enabled } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'name and address are required',
      });
    }

    const config = await wireguardService.createOrUpdateInterface({
      name,
      address,
      listenPort: parseInt(listenPort) || 51820,
      mtu: parseInt(mtu) || 1420,
      enabled: enabled === true,
    });

    res.json(config);
  } catch (error: any) {
    console.error('[WireguardRoutes] Error updating interface:', error.message);
    res.status(500).json({
      error: 'Failed to update WireGuard interface',
      message: error.message,
    });
  }
});

/**
 * POST /api/wireguard/interface/generate-keys
 * Generate new key pair for the interface
 */
wireguardRoutes.post('/interface/generate-keys', async (req: Request, res: Response) => {
  try {
    const result = await wireguardService.regenerateKeys();
    res.json(result);
  } catch (error: any) {
    console.error('[WireguardRoutes] Error generating keys:', error.message);
    res.status(500).json({
      error: 'Failed to generate keys',
      message: error.message,
    });
  }
});

/**
 * POST /api/wireguard/interface/toggle
 * Enable or disable the WireGuard interface
 */
wireguardRoutes.post('/interface/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'enabled must be a boolean',
      });
    }

    await wireguardService.toggleInterface(enabled);
    res.json({ success: true, enabled });
  } catch (error: any) {
    console.error('[WireguardRoutes] Error toggling interface:', error.message);
    res.status(500).json({
      error: 'Failed to toggle interface',
      message: error.message,
    });
  }
});

// ============ Peer Management ============

/**
 * GET /api/wireguard/peers
 * Get all VPN peers
 */
wireguardRoutes.get('/peers', async (req: Request, res: Response) => {
  try {
    const peers = await wireguardService.getPeers();
    res.json(peers);
  } catch (error: any) {
    console.error('[WireguardRoutes] Error getting peers:', error.message);
    res.status(500).json({
      error: 'Failed to get peers',
      message: error.message,
    });
  }
});

/**
 * POST /api/wireguard/peers
 * Add new VPN peer
 */
wireguardRoutes.post('/peers', async (req: Request, res: Response) => {
  try {
    const { name, publicKey, allowedIPs, endpoint, persistentKeepalive } = req.body;

    if (!name || !publicKey || !allowedIPs) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'name, publicKey, and allowedIPs are required',
      });
    }

    const peerData: PeerFormData = {
      name,
      publicKey,
      allowedIPs,
      endpoint,
      persistentKeepalive: persistentKeepalive ? parseInt(persistentKeepalive) : undefined,
    };

    const peer = await wireguardService.addPeer(peerData);
    res.json(peer);
  } catch (error: any) {
    console.error('[WireguardRoutes] Error adding peer:', error.message);
    res.status(500).json({
      error: 'Failed to add peer',
      message: error.message,
    });
  }
});

/**
 * PUT /api/wireguard/peers/:id
 * Update VPN peer configuration
 */
wireguardRoutes.put('/peers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, allowedIPs, endpoint, persistentKeepalive } = req.body;

    const peerData: Partial<PeerFormData> = {
      name,
      allowedIPs,
      endpoint,
      persistentKeepalive: persistentKeepalive ? parseInt(persistentKeepalive) : undefined,
    };

    const peer = await wireguardService.updatePeer(id, peerData);
    res.json(peer);
  } catch (error: any) {
    console.error('[WireguardRoutes] Error updating peer:', error.message);

    if (error.message === 'Peer not found') {
      return res.status(404).json({
        error: 'Not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to update peer',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/wireguard/peers/:id
 * Delete VPN peer
 */
wireguardRoutes.delete('/peers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await wireguardService.deletePeer(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[WireguardRoutes] Error deleting peer:', error.message);

    if (error.message === 'Peer not found') {
      return res.status(404).json({
        error: 'Not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to delete peer',
      message: error.message,
    });
  }
});

/**
 * GET /api/wireguard/peers/:id/qrcode
 * Generate QR code for peer configuration
 */
wireguardRoutes.get('/peers/:id/qrcode', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const qrData = await wireguardService.generatePeerQRCode(id);
    res.json(qrData);
  } catch (error: any) {
    console.error('[WireguardRoutes] Error generating QR code:', error.message);

    if (error.message === 'Peer not found') {
      return res.status(404).json({
        error: 'Not found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to generate QR code',
      message: error.message,
    });
  }
});

// ============ Statistics ============

/**
 * GET /api/wireguard/stats
 * Get WireGuard statistics
 */
wireguardRoutes.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await wireguardService.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[WireguardRoutes] Error getting stats:', error.message);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message,
    });
  }
});
