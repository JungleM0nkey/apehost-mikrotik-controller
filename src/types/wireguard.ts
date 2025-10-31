export interface WireguardInterface {
  name: string;
  address: string;
  listenPort: number;
  privateKey: string;
  publicKey: string;
  mtu: number;
  enabled: boolean;
}

export interface WireguardPeer {
  id: string;
  name: string;
  publicKey: string;
  allowedIPs: string;
  endpoint?: string;
  persistentKeepalive?: number;

  // Runtime stats from MikroTik
  lastHandshake?: Date;
  rxBytes?: number;
  txBytes?: number;
  currentEndpoint?: string;
}

export interface WireguardStats {
  totalPeers: number;
  activePeers: number;
  totalRx: number;
  totalTx: number;
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
