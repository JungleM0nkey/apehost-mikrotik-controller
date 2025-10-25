/**
 * Router Data Types
 */

export interface RouterInfo {
  name: string;
  ipAddress: string;
  status: 'online' | 'offline' | 'connecting';
  model: string;
  osVersion: string;
  macAddress?: string;
  subnet?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  ipAddress: string;
  timestamp: string;
}

export interface UserProfile {
  username: string;
  email: string;
  initials: string;
}
