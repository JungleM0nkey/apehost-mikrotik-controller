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
