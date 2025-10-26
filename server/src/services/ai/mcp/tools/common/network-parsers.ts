/**
 * Network parsing utilities for IP addresses, CIDR notation, ports, and protocols
 */

/**
 * Parse IP address and validate format
 */
export function parseIPAddress(ip: string): { valid: boolean; address?: string; error?: string } {
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);

  if (!match) {
    return { valid: false, error: 'Invalid IP address format' };
  }

  const octets = match.slice(1, 5).map(Number);
  const invalidOctet = octets.find((octet) => octet > 255);

  if (invalidOctet !== undefined) {
    return { valid: false, error: 'IP address octet out of range (0-255)' };
  }

  return { valid: true, address: ip };
}

/**
 * Parse CIDR notation (e.g., "192.168.1.0/24")
 */
export function parseCIDR(cidr: string): {
  valid: boolean;
  network?: string;
  prefix?: number;
  error?: string;
} {
  const parts = cidr.split('/');

  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid CIDR format - expected IP/prefix' };
  }

  const ipCheck = parseIPAddress(parts[0]);
  if (!ipCheck.valid) {
    return { valid: false, error: ipCheck.error };
  }

  const prefix = parseInt(parts[1], 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    return { valid: false, error: 'Invalid prefix length - must be 0-32' };
  }

  return { valid: true, network: parts[0], prefix };
}

/**
 * Check if an IP address is within a CIDR range
 */
export function ipInCIDR(ip: string, cidr: string): boolean {
  const ipParsed = parseIPAddress(ip);
  const cidrParsed = parseCIDR(cidr);

  if (!ipParsed.valid || !cidrParsed.valid) {
    return false;
  }

  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(cidrParsed.network!);
  const mask = ~((1 << (32 - cidrParsed.prefix!)) - 1);

  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Convert IP address to 32-bit number
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Convert 32-bit number back to IP address
 */
export function numberToIP(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

/**
 * Parse port number or range
 */
export function parsePort(port: string | number): {
  valid: boolean;
  port?: number;
  portRange?: { start: number; end: number };
  error?: string;
} {
  if (typeof port === 'number') {
    if (port < 1 || port > 65535) {
      return { valid: false, error: 'Port out of range (1-65535)' };
    }
    return { valid: true, port };
  }

  // Check for port range (e.g., "80-443")
  if (port.includes('-')) {
    const [start, end] = port.split('-').map((p) => parseInt(p.trim(), 10));
    if (isNaN(start) || isNaN(end) || start < 1 || end > 65535 || start > end) {
      return { valid: false, error: 'Invalid port range' };
    }
    return { valid: true, portRange: { start, end } };
  }

  // Single port
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, error: 'Port out of range (1-65535)' };
  }

  return { valid: true, port: portNum };
}

/**
 * Get common service port mappings
 */
export function getServicePort(service: string): number | undefined {
  const servicePorts: Record<string, number> = {
    http: 80,
    https: 443,
    ssh: 22,
    ftp: 21,
    telnet: 23,
    smtp: 25,
    dns: 53,
    dhcp: 67,
    pop3: 110,
    imap: 143,
    snmp: 161,
    ldap: 389,
    smb: 445,
    rdp: 3389,
    mysql: 3306,
    postgresql: 5432,
    mongodb: 27017,
    redis: 6379,
  };

  return servicePorts[service.toLowerCase()];
}

/**
 * Parse protocol name to RouterOS format
 */
export function parseProtocol(protocol: string): {
  valid: boolean;
  protocol?: string;
  error?: string;
} {
  const validProtocols = ['tcp', 'udp', 'icmp', 'gre', 'esp', 'ah', 'ipip', 'ipsec-esp', 'ipsec-ah'];
  const normalizedProtocol = protocol.toLowerCase();

  if (!validProtocols.includes(normalizedProtocol)) {
    return {
      valid: false,
      error: `Invalid protocol - must be one of: ${validProtocols.join(', ')}`,
    };
  }

  return { valid: true, protocol: normalizedProtocol };
}

/**
 * Match RouterOS address format (can be IP, CIDR, or address list)
 */
export function matchesAddress(testIp: string, addressPattern: string): boolean {
  // Exact IP match
  if (addressPattern === testIp) {
    return true;
  }

  // CIDR range match
  if (addressPattern.includes('/')) {
    return ipInCIDR(testIp, addressPattern);
  }

  // Address list reference (e.g., "!blocklist")
  if (addressPattern.startsWith('!')) {
    // Can't evaluate address lists without additional context
    return false;
  }

  return false;
}

/**
 * Check if port matches a port specification (single port or range)
 */
export function matchesPort(testPort: number, portPattern: string | number): boolean {
  const parsed = parsePort(portPattern);

  if (!parsed.valid) {
    return false;
  }

  if (parsed.port !== undefined) {
    return testPort === parsed.port;
  }

  if (parsed.portRange !== undefined) {
    return testPort >= parsed.portRange.start && testPort <= parsed.portRange.end;
  }

  return false;
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}
