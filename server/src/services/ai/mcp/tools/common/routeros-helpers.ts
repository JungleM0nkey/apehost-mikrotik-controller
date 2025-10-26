/**
 * RouterOS API helper functions for MCP tools
 * Provides typed wrappers around mikrotikService with error handling
 */

import mikrotikService from '../../../../mikrotik.js';

/**
 * Execute a RouterOS command and return parsed results
 */
export async function executeRouterOSCommand<T = any>(
  command: string,
  params?: Record<string, string>
): Promise<T[]> {
  try {
    const result = await mikrotikService.executeCommand(command, params);
    return Array.isArray(result) ? result : [result];
  } catch (error) {
    throw new Error(`RouterOS command failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Execute multiple RouterOS commands in sequence
 */
export async function executeRouterOSCommands(
  commands: Array<{ command: string; params?: Record<string, string> }>
): Promise<any[]> {
  const results = [];

  for (const { command, params } of commands) {
    const result = await executeRouterOSCommand(command, params);
    results.push(result);
  }

  return results;
}

/**
 * Parse RouterOS sentence data (key-value pairs from API)
 */
export function parseSentence(sentence: any): Record<string, any> {
  if (!sentence || typeof sentence !== 'object') {
    return {};
  }

  const parsed: Record<string, any> = {};

  for (const [key, value] of Object.entries(sentence)) {
    // Remove leading dot from .id field
    const cleanKey = key.startsWith('.') ? key.slice(1) : key;

    // Convert string booleans to actual booleans
    if (value === 'true') {
      parsed[cleanKey] = true;
    } else if (value === 'false') {
      parsed[cleanKey] = false;
    } else {
      parsed[cleanKey] = value;
    }
  }

  return parsed;
}

/**
 * Parse multiple RouterOS sentences
 */
export function parseSentences(sentences: any[]): Array<Record<string, any>> {
  return sentences.map(parseSentence);
}

/**
 * Build WHERE clause for RouterOS query
 */
export function buildWhereClause(conditions: Record<string, any>): Record<string, string> {
  const params: Record<string, string> = {};

  Object.entries(conditions).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params[`?${key}`] = String(value);
    }
  });

  return params;
}

/**
 * Parse firewall rule from RouterOS data
 */
export interface FirewallRule {
  id: string;
  chain: string;
  action: string;
  protocol?: string;
  srcAddress?: string;
  srcPort?: string;
  dstAddress?: string;
  dstPort?: string;
  inInterface?: string;
  outInterface?: string;
  comment?: string;
  disabled: boolean;
  bytes: number;
  packets: number;
  dynamic: boolean;
  invalid: boolean;
}

export function parseFirewallRule(sentence: any): FirewallRule {
  const parsed = parseSentence(sentence);

  return {
    id: parsed.id || '',
    chain: parsed.chain || '',
    action: parsed.action || '',
    protocol: parsed.protocol,
    srcAddress: parsed['src-address'],
    srcPort: parsed['src-port'],
    dstAddress: parsed['dst-address'],
    dstPort: parsed['dst-port'],
    inInterface: parsed['in-interface'],
    outInterface: parsed['out-interface'],
    comment: parsed.comment,
    disabled: parsed.disabled === true || parsed.disabled === 'true',
    bytes: parseInt(parsed.bytes || '0', 10),
    packets: parseInt(parsed.packets || '0', 10),
    dynamic: parsed.dynamic === true || parsed.dynamic === 'true',
    invalid: parsed.invalid === true || parsed.invalid === 'true',
  };
}

/**
 * Parse route entry from RouterOS data
 */
export interface RouteEntry {
  id: string;
  dstAddress: string;
  gateway?: string;
  gatewayStatus?: string;
  distance: number;
  scope: number;
  targetScope: number;
  interface?: string;
  comment?: string;
  disabled: boolean;
  dynamic: boolean;
  active: boolean;
}

export function parseRoute(sentence: any): RouteEntry {
  const parsed = parseSentence(sentence);

  return {
    id: parsed.id || '',
    dstAddress: parsed['dst-address'] || '',
    gateway: parsed.gateway,
    gatewayStatus: parsed['gateway-status'],
    distance: parseInt(parsed.distance || '1', 10),
    scope: parseInt(parsed.scope || '30', 10),
    targetScope: parseInt(parsed['target-scope'] || '10', 10),
    interface: parsed.interface,
    comment: parsed.comment,
    disabled: parsed.disabled === true || parsed.disabled === 'true',
    dynamic: parsed.dynamic === true || parsed.dynamic === 'true',
    active: parsed.active === true || parsed.active === 'true',
  };
}

/**
 * Parse interface from RouterOS data
 */
export interface InterfaceInfo {
  id: string;
  name: string;
  type: string;
  mtu: number;
  running: boolean;
  disabled: boolean;
  comment?: string;
}

export function parseInterface(sentence: any): InterfaceInfo {
  const parsed = parseSentence(sentence);

  return {
    id: parsed.id || '',
    name: parsed.name || '',
    type: parsed.type || '',
    mtu: parseInt(parsed.mtu || '1500', 10),
    running: parsed.running === true || parsed.running === 'true',
    disabled: parsed.disabled === true || parsed.disabled === 'true',
    comment: parsed.comment,
  };
}

/**
 * Parse IP address from RouterOS data
 */
export interface IPAddress {
  id: string;
  address: string;
  network: string;
  interface: string;
  disabled: boolean;
  dynamic: boolean;
  invalid: boolean;
}

export function parseIPAddress(sentence: any): IPAddress {
  const parsed = parseSentence(sentence);

  return {
    id: parsed.id || '',
    address: parsed.address || '',
    network: parsed.network || '',
    interface: parsed.interface || '',
    disabled: parsed.disabled === true || parsed.disabled === 'true',
    dynamic: parsed.dynamic === true || parsed.dynamic === 'true',
    invalid: parsed.invalid === true || parsed.invalid === 'true',
  };
}

/**
 * Parse ARP entry from RouterOS data
 */
export interface ARPEntry {
  id: string;
  address: string;
  macAddress: string;
  interface: string;
  complete: boolean;
  disabled: boolean;
  dynamic: boolean;
  invalid: boolean;
}

export function parseARPEntry(sentence: any): ARPEntry {
  const parsed = parseSentence(sentence);

  return {
    id: parsed.id || '',
    address: parsed.address || '',
    macAddress: parsed['mac-address'] || '',
    interface: parsed.interface || '',
    complete: parsed.complete === true || parsed.complete === 'true',
    disabled: parsed.disabled === true || parsed.disabled === 'true',
    dynamic: parsed.dynamic === true || parsed.dynamic === 'true',
    invalid: parsed.invalid === true || parsed.invalid === 'true',
  };
}

/**
 * Parse connection tracking entry from RouterOS data
 */
export interface ConnectionEntry {
  protocol: string;
  srcAddress: string;
  dstAddress: string;
  replyDstAddress: string;
  replySrcAddress: string;
  timeout: string;
  assured: boolean;
  confirmed: boolean;
}

export function parseConnection(sentence: any): ConnectionEntry {
  const parsed = parseSentence(sentence);

  return {
    protocol: parsed.protocol || '',
    srcAddress: parsed['src-address'] || '',
    dstAddress: parsed['dst-address'] || '',
    replyDstAddress: parsed['reply-dst-address'] || '',
    replySrcAddress: parsed['reply-src-address'] || '',
    timeout: parsed.timeout || '',
    assured: parsed.assured === true || parsed.assured === 'true',
    confirmed: parsed.confirmed === true || parsed.confirmed === 'true',
  };
}
