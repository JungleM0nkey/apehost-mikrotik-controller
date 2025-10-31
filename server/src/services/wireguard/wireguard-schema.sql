-- WireGuard VPN Database Schema
-- SQLite database for WireGuard interface and peer management

-- WireGuard interface configuration table
CREATE TABLE IF NOT EXISTS wireguard_interface (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  listen_port INTEGER NOT NULL,
  private_key TEXT NOT NULL,
  public_key TEXT NOT NULL,
  mtu INTEGER NOT NULL DEFAULT 1420,
  enabled BOOLEAN NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  mikrotik_id TEXT,
  last_sync_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_interface_name ON wireguard_interface(name);
CREATE INDEX IF NOT EXISTS idx_interface_enabled ON wireguard_interface(enabled);

-- WireGuard peers table
CREATE TABLE IF NOT EXISTS wireguard_peers (
  id TEXT PRIMARY KEY,
  interface_id TEXT NOT NULL,
  name TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  allowed_ips TEXT NOT NULL,
  endpoint TEXT,
  persistent_keepalive INTEGER,
  preshared_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  mikrotik_id TEXT,
  last_sync_at INTEGER,

  -- Runtime statistics from MikroTik
  last_handshake INTEGER,
  rx_bytes INTEGER DEFAULT 0,
  tx_bytes INTEGER DEFAULT 0,
  current_endpoint TEXT,

  FOREIGN KEY (interface_id) REFERENCES wireguard_interface(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_peers_interface ON wireguard_peers(interface_id);
CREATE INDEX IF NOT EXISTS idx_peers_name ON wireguard_peers(name);
CREATE INDEX IF NOT EXISTS idx_peers_public_key ON wireguard_peers(public_key);
CREATE INDEX IF NOT EXISTS idx_peers_created ON wireguard_peers(created_at DESC);

-- WireGuard connection history for analytics
CREATE TABLE IF NOT EXISTS wireguard_connection_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  peer_id TEXT NOT NULL,
  connected_at INTEGER NOT NULL,
  disconnected_at INTEGER,
  duration_seconds INTEGER,
  rx_bytes INTEGER DEFAULT 0,
  tx_bytes INTEGER DEFAULT 0,

  FOREIGN KEY (peer_id) REFERENCES wireguard_peers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_history_peer ON wireguard_connection_history(peer_id);
CREATE INDEX IF NOT EXISTS idx_history_time ON wireguard_connection_history(connected_at DESC);
