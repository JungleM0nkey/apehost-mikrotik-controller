import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface WireguardInterface {
  id: string;
  name: string;
  address: string;
  listen_port: number;
  private_key: string;
  public_key: string;
  mtu: number;
  enabled: boolean;
  created_at: number;
  updated_at: number;
  mikrotik_id?: string;
  last_sync_at?: number;
}

export interface WireguardPeer {
  id: string;
  interface_id: string;
  name: string;
  public_key: string;
  allowed_ips: string;
  endpoint?: string;
  persistent_keepalive?: number;
  preshared_key?: string;
  created_at: number;
  updated_at: number;
  mikrotik_id?: string;
  last_sync_at?: number;

  // Runtime stats
  last_handshake?: number;
  rx_bytes?: number;
  tx_bytes?: number;
  current_endpoint?: string;
}

export interface ConnectionHistory {
  id: number;
  peer_id: string;
  connected_at: number;
  disconnected_at?: number;
  duration_seconds?: number;
  rx_bytes?: number;
  tx_bytes?: number;
}

export class WireguardDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || join(process.cwd(), 'data', 'wireguard.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    const schemaPath = join(__dirname, 'wireguard-schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
    console.log(`[WireguardDB] Database initialized at ${this.dbPath}`);
  }

  // ============ Interface Operations ============

  createInterface(config: Omit<WireguardInterface, 'id' | 'created_at' | 'updated_at'>): WireguardInterface {
    const id = randomUUID();
    const now = Date.now();
    const fullInterface: WireguardInterface = {
      ...config,
      id,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO wireguard_interface (
        id, name, address, listen_port, private_key, public_key,
        mtu, enabled, created_at, updated_at, mikrotik_id, last_sync_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullInterface.id,
      fullInterface.name,
      fullInterface.address,
      fullInterface.listen_port,
      fullInterface.private_key,
      fullInterface.public_key,
      fullInterface.mtu,
      fullInterface.enabled ? 1 : 0,
      fullInterface.created_at,
      fullInterface.updated_at,
      fullInterface.mikrotik_id || null,
      fullInterface.last_sync_at || null
    );

    return fullInterface;
  }

  getInterface(id: string): WireguardInterface | null {
    const stmt = this.db.prepare('SELECT * FROM wireguard_interface WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.parseInterfaceRow(row) : null;
  }

  getInterfaceByName(name: string): WireguardInterface | null {
    const stmt = this.db.prepare('SELECT * FROM wireguard_interface WHERE name = ?');
    const row = stmt.get(name) as any;
    return row ? this.parseInterfaceRow(row) : null;
  }

  getAllInterfaces(): WireguardInterface[] {
    const stmt = this.db.prepare('SELECT * FROM wireguard_interface ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.parseInterfaceRow(row));
  }

  updateInterface(id: string, updates: Partial<Omit<WireguardInterface, 'id' | 'created_at'>>): void {
    const fields: string[] = [];
    const values: any[] = [];

    fields.push('updated_at = ?');
    values.push(Date.now());

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.address !== undefined) {
      fields.push('address = ?');
      values.push(updates.address);
    }
    if (updates.listen_port !== undefined) {
      fields.push('listen_port = ?');
      values.push(updates.listen_port);
    }
    if (updates.private_key !== undefined) {
      fields.push('private_key = ?');
      values.push(updates.private_key);
    }
    if (updates.public_key !== undefined) {
      fields.push('public_key = ?');
      values.push(updates.public_key);
    }
    if (updates.mtu !== undefined) {
      fields.push('mtu = ?');
      values.push(updates.mtu);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.mikrotik_id !== undefined) {
      fields.push('mikrotik_id = ?');
      values.push(updates.mikrotik_id);
    }
    if (updates.last_sync_at !== undefined) {
      fields.push('last_sync_at = ?');
      values.push(updates.last_sync_at);
    }

    if (fields.length === 1) return; // Only updated_at

    values.push(id);
    const query = `UPDATE wireguard_interface SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...values);
  }

  deleteInterface(id: string): void {
    const stmt = this.db.prepare('DELETE FROM wireguard_interface WHERE id = ?');
    stmt.run(id);
  }

  // ============ Peer Operations ============

  createPeer(peer: Omit<WireguardPeer, 'id' | 'created_at' | 'updated_at'>): WireguardPeer {
    const id = randomUUID();
    const now = Date.now();
    const fullPeer: WireguardPeer = {
      ...peer,
      id,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO wireguard_peers (
        id, interface_id, name, public_key, allowed_ips, endpoint,
        persistent_keepalive, preshared_key, created_at, updated_at,
        mikrotik_id, last_sync_at, last_handshake, rx_bytes, tx_bytes, current_endpoint
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullPeer.id,
      fullPeer.interface_id,
      fullPeer.name,
      fullPeer.public_key,
      fullPeer.allowed_ips,
      fullPeer.endpoint || null,
      fullPeer.persistent_keepalive || null,
      fullPeer.preshared_key || null,
      fullPeer.created_at,
      fullPeer.updated_at,
      fullPeer.mikrotik_id || null,
      fullPeer.last_sync_at || null,
      fullPeer.last_handshake || null,
      fullPeer.rx_bytes || 0,
      fullPeer.tx_bytes || 0,
      fullPeer.current_endpoint || null
    );

    return fullPeer;
  }

  getPeer(id: string): WireguardPeer | null {
    const stmt = this.db.prepare('SELECT * FROM wireguard_peers WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.parsePeerRow(row) : null;
  }

  getPeersByInterface(interface_id: string): WireguardPeer[] {
    const stmt = this.db.prepare('SELECT * FROM wireguard_peers WHERE interface_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(interface_id) as any[];
    return rows.map(row => this.parsePeerRow(row));
  }

  getAllPeers(): WireguardPeer[] {
    const stmt = this.db.prepare('SELECT * FROM wireguard_peers ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.parsePeerRow(row));
  }

  updatePeer(id: string, updates: Partial<Omit<WireguardPeer, 'id' | 'created_at'>>): void {
    const fields: string[] = [];
    const values: any[] = [];

    fields.push('updated_at = ?');
    values.push(Date.now());

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.public_key !== undefined) {
      fields.push('public_key = ?');
      values.push(updates.public_key);
    }
    if (updates.allowed_ips !== undefined) {
      fields.push('allowed_ips = ?');
      values.push(updates.allowed_ips);
    }
    if (updates.endpoint !== undefined) {
      fields.push('endpoint = ?');
      values.push(updates.endpoint);
    }
    if (updates.persistent_keepalive !== undefined) {
      fields.push('persistent_keepalive = ?');
      values.push(updates.persistent_keepalive);
    }
    if (updates.preshared_key !== undefined) {
      fields.push('preshared_key = ?');
      values.push(updates.preshared_key);
    }
    if (updates.mikrotik_id !== undefined) {
      fields.push('mikrotik_id = ?');
      values.push(updates.mikrotik_id);
    }
    if (updates.last_sync_at !== undefined) {
      fields.push('last_sync_at = ?');
      values.push(updates.last_sync_at);
    }
    if (updates.last_handshake !== undefined) {
      fields.push('last_handshake = ?');
      values.push(updates.last_handshake);
    }
    if (updates.rx_bytes !== undefined) {
      fields.push('rx_bytes = ?');
      values.push(updates.rx_bytes);
    }
    if (updates.tx_bytes !== undefined) {
      fields.push('tx_bytes = ?');
      values.push(updates.tx_bytes);
    }
    if (updates.current_endpoint !== undefined) {
      fields.push('current_endpoint = ?');
      values.push(updates.current_endpoint);
    }

    if (fields.length === 1) return; // Only updated_at

    values.push(id);
    const query = `UPDATE wireguard_peers SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...values);
  }

  deletePeer(id: string): void {
    const stmt = this.db.prepare('DELETE FROM wireguard_peers WHERE id = ?');
    stmt.run(id);
  }

  // ============ Connection History ============

  recordConnection(peer_id: string, connected_at: number): number {
    const stmt = this.db.prepare(`
      INSERT INTO wireguard_connection_history (peer_id, connected_at)
      VALUES (?, ?)
    `);
    const result = stmt.run(peer_id, connected_at);
    return result.lastInsertRowid as number;
  }

  closeConnection(
    connection_id: number,
    disconnected_at: number,
    rx_bytes: number,
    tx_bytes: number
  ): void {
    const duration = Math.floor((disconnected_at - Date.now()) / 1000);
    const stmt = this.db.prepare(`
      UPDATE wireguard_connection_history
      SET disconnected_at = ?, duration_seconds = ?, rx_bytes = ?, tx_bytes = ?
      WHERE id = ?
    `);
    stmt.run(disconnected_at, duration, rx_bytes, tx_bytes, connection_id);
  }

  getConnectionHistory(peer_id: string, limit = 50): ConnectionHistory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM wireguard_connection_history
      WHERE peer_id = ?
      ORDER BY connected_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(peer_id, limit) as any[];
    return rows.map(row => this.parseHistoryRow(row));
  }

  // ============ Helper Methods ============

  private parseInterfaceRow(row: any): WireguardInterface {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      listen_port: row.listen_port,
      private_key: row.private_key,
      public_key: row.public_key,
      mtu: row.mtu,
      enabled: row.enabled === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
      mikrotik_id: row.mikrotik_id,
      last_sync_at: row.last_sync_at,
    };
  }

  private parsePeerRow(row: any): WireguardPeer {
    return {
      id: row.id,
      interface_id: row.interface_id,
      name: row.name,
      public_key: row.public_key,
      allowed_ips: row.allowed_ips,
      endpoint: row.endpoint,
      persistent_keepalive: row.persistent_keepalive,
      preshared_key: row.preshared_key,
      created_at: row.created_at,
      updated_at: row.updated_at,
      mikrotik_id: row.mikrotik_id,
      last_sync_at: row.last_sync_at,
      last_handshake: row.last_handshake,
      rx_bytes: row.rx_bytes,
      tx_bytes: row.tx_bytes,
      current_endpoint: row.current_endpoint,
    };
  }

  private parseHistoryRow(row: any): ConnectionHistory {
    return {
      id: row.id,
      peer_id: row.peer_id,
      connected_at: row.connected_at,
      disconnected_at: row.disconnected_at,
      duration_seconds: row.duration_seconds,
      rx_bytes: row.rx_bytes,
      tx_bytes: row.tx_bytes,
    };
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let instance: WireguardDatabase | null = null;

export function getWireguardDatabase(): WireguardDatabase {
  if (!instance) {
    instance = new WireguardDatabase();
  }
  return instance;
}
