// API Response Types

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
}

export interface RouterStatus {
  name: string;
  ip: string;
  model: string;
  version: string;
  status: 'online' | 'offline' | 'error';
  cpuLoad: number;
  memoryUsed: number;
  memoryTotal: number;
  uptime: number;
  timestamp: string;
  macAddress?: string;
  subnet?: string;
  cpuArchitecture?: string;
  cpuCount?: number;
}

export interface NetworkInterface {
  id: string;
  name: string;
  type: string;
  status: 'up' | 'down';
  rxRate: number;
  txRate: number;
  rxBytes: number;
  txBytes: number;
  comment?: string;
}

export interface UpdateInterfaceRequest {
  name?: string;
  comment?: string;
  disabled?: boolean;
}

export interface IpAddress {
  id: string;
  address: string;
  network: string;
  interface: string;
  status: 'active' | 'inactive';
  dynamic: boolean;
  disabled: boolean;
  invalid: boolean;
  comment?: string;
}

export interface Route {
  id: string;
  dstAddress: string;
  gateway: string;
  gatewayStatus: 'reachable' | 'unreachable';
  distance: number;
  scope: number;
  targetScope: number;
  interface?: string;
  dynamic: boolean;
  active: boolean;
  static: boolean;
  comment?: string;
}

export interface ArpEntry {
  id: string;
  address: string;
  macAddress: string;
  interface: string;
  status: 'reachable' | 'stale' | 'delay' | 'probe' | 'failed';
  dynamic: boolean;
  published: boolean;
  invalid: boolean;
  dhcp: boolean;
  complete: boolean;
  disabled: boolean;
  comment?: string;
}

export interface SystemResources {
  cpu: {
    load: number;
    count: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  timestamp: string;
}

export interface TerminalCommandRequest {
  command: string;
}

export interface TerminalCommandResponse {
  command: string;
  output: string;
  timestamp: string;
  executionTime?: number;
  error?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  path?: string;
}
