import { RouterOSAPI } from 'node-routeros';

export interface MikroTikConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  timeout: number;
  keepaliveInterval: number;
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

export interface HealthStatus {
  connected: boolean;
  connectedSince: string | null;
  lastError: string | null;
  routerIdentity: string | null;
  host: string;
  port: number;
}

class MikroTikService {
  private static instance: MikroTikService | null = null;
  private config: MikroTikConfig | null = null;
  private connection: RouterOSAPI | null = null;
  private isConnected: boolean = false;
  private connectedSince: Date | null = null;
  private lastError: string | null = null;
  private routerIdentity: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectBackoff: number[] = [1000, 2000, 4000, 8000, 16000, 30000];
  private isReconnecting: boolean = false;
  private isConnecting: boolean = false;
  private connectingPromise: Promise<boolean> | null = null;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private requestQueue: Array<{resolve: Function; reject: Function; command: string}> = [];
  private isProcessingQueue: boolean = false;
  
  // Cache system
  private cache: Map<string, {data: any; timestamp: number; ttl: number}> = new Map();
  private defaultCacheTTL: number = 5000; // 5 seconds default
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  private constructor() {
    // Lazy initialization - config loaded on first use
  }

  public static getInstance(): MikroTikService {
    if (!MikroTikService.instance) {
      MikroTikService.instance = new MikroTikService();
    }
    return MikroTikService.instance;
  }

  private loadConfig(): MikroTikConfig {
    if (!this.config) {
      const host = process.env.MIKROTIK_HOST;
      if (!host) {
        throw new Error('MIKROTIK_HOST environment variable is required');
      }

      this.config = {
        host,
        port: parseInt(process.env.MIKROTIK_PORT || '8728'),
        user: process.env.MIKROTIK_USERNAME || 'admin',
        password: process.env.MIKROTIK_PASSWORD || '',
        timeout: parseInt(process.env.MIKROTIK_TIMEOUT || '10000'),
        keepaliveInterval: parseInt(process.env.MIKROTIK_KEEPALIVE_SEC || '30') * 1000,
      };

      console.log(`[MikroTik] Configuration loaded: ${this.config.host}:${this.config.port} (user: ${this.config.user})`);
    }
    return this.config;
  }

  /**
   * Ensure connection is established (with mutex to prevent race conditions)
   */
  private async ensureConnected(): Promise<void> {
    if (this.isConnected && this.connection) {
      return;
    }
    
    // If already connecting, wait for that connection attempt
    if (this.isConnecting && this.connectingPromise) {
      await this.connectingPromise;
      return;
    }
    
    await this.connect();
  }

  /**
   * Connect to MikroTik router
   */
  public async connect(): Promise<boolean> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting && this.connectingPromise) {
      return this.connectingPromise;
    }
    
    this.isConnecting = true;
    this.connectingPromise = this._doConnect();
    
    try {
      const result = await this.connectingPromise;
      return result;
    } finally {
      this.isConnecting = false;
      this.connectingPromise = null;
    }
  }
  
  /**
   * Internal connection implementation
   */
  private async _doConnect(): Promise<boolean> {
    try {
      const config = this.loadConfig();
      console.log(`[MikroTik] Connecting to ${config.host}:${config.port}...`);
      
      this.connection = new RouterOSAPI({
        host: config.host,
        user: config.user,
        password: config.password,
        port: config.port,
        timeout: config.timeout,
      });

      // Set up event listeners
      this.connection.on('close', () => {
        console.log('[MikroTik] Connection closed');
        this.handleDisconnect();
      });

      this.connection.on('error', (err: Error) => {
        console.error('[MikroTik] Connection error:', err.message);
        this.lastError = err.message;
      });

      await this.connection.connect();
      this.isConnected = true;
      this.connectedSince = new Date();
      this.reconnectAttempts = 0;
      this.lastError = null;
      
      // Fetch router identity
      try {
        this.routerIdentity = await this.getIdentity();
      } catch (err) {
        console.warn('[MikroTik] Failed to fetch router identity');
      }

      console.log(`[MikroTik] Successfully connected to ${config.host}`);
      
      // Start keepalive
      this.startKeepalive();
      
      return true;
    } catch (error: any) {
      console.error('[MikroTik] Failed to connect:', error.message);
      this.lastError = error.message;
      this.isConnected = false;
      this.connection = null;
      throw error;
    }
  }

  /**
   * Handle unexpected disconnection
   */
  private handleDisconnect(): void {
    if (!this.isConnected) return; // Already handling disconnect
    
    this.isConnected = false;
    this.connectedSince = null;
    this.stopKeepalive();
    
    // Clear cache on disconnect
    this.clearCache();
    console.log('[MikroTik] Cache cleared due to disconnection');
    
    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isReconnecting) {
      this.reconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[MikroTik] Max reconnection attempts reached. Manual intervention required.');
    }
  }

  /**
   * Reconnect with exponential backoff
   */
  private async reconnect(): Promise<void> {
    if (this.isReconnecting) return;
    
    this.isReconnecting = true;
    const backoffMs = this.reconnectBackoff[Math.min(this.reconnectAttempts, this.reconnectBackoff.length - 1)];
    this.reconnectAttempts++;
    
    console.log(`[MikroTik] Reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    await new Promise(resolve => setTimeout(resolve, backoffMs));
    
    try {
      await this.connect();
      console.log('[MikroTik] Reconnection successful');
    } catch (error: any) {
      console.error('[MikroTik] Reconnection failed:', error.message);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnect();
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Disconnect from router
   */
  public async disconnect(reason?: string): Promise<void> {
    this.stopKeepalive();
    
    if (this.connection) {
      try {
        await this.connection.close();
        console.log(`[MikroTik] Disconnected from router${reason ? ` (${reason})` : ''}`);
      } catch (error: any) {
        console.error('[MikroTik] Error during disconnect:', error.message);
      }
      this.connection = null;
      this.isConnected = false;
      this.connectedSince = null;
    }
  }

  /**
   * Start keepalive pings
   */
  private startKeepalive(): void {
    this.stopKeepalive();
    
    const config = this.loadConfig();
    this.keepaliveTimer = setInterval(async () => {
      if (!this.isConnected) {
        this.stopKeepalive();
        return;
      }
      
      try {
        await this.executeCommand('/system/identity/print');
      } catch (error) {
        console.warn('[MikroTik] Keepalive failed');
      }
    }, config.keepaliveInterval);
  }

  /**
   * Stop keepalive pings
   */
  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  /**
   * Execute a command on the router with request queuing
   */
  private async executeCommand(command: string): Promise<any[]> {
    await this.ensureConnected();
    
    // Queue the request
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, command });
      this.processQueue();
    });
  }
  
  /**
   * Process queued requests sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) break;
      
      try {
        const result = await this.connection!.write(request.command);
        request.resolve(result);
      } catch (error: any) {
        console.error(`[MikroTik] Error executing command "${request.command}":`, error.message);
        this.lastError = error.message;
        request.reject(error);
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Get router system resources
   */
  async getSystemResources(): Promise<any> {
    try {
      const result = await this.executeCommand('/system/resource/print');
      return result[0] || null;
    } catch (error) {
      console.error('Error getting system resources:', error);
      throw error;
    }
  }

  /**
   * Get router identity
   */
  private async getIdentity(): Promise<string> {
    try {
      const result = await this.executeCommand('/system/identity/print');
      return result[0]?.name || 'MikroTik';
    } catch (error) {
      console.error('[MikroTik] Error getting identity:', error);
      return 'MikroTik';
    }
  }

  /**
   * Get cached data or fetch if expired
   */
  private async getCached<T>(key: string, fetcher: () => Promise<T>, ttl: number = this.defaultCacheTTL): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < cached.ttl) {
      this.cacheHits++;
      console.log(`[MikroTik] Cache HIT for ${key} (hits: ${this.cacheHits}, misses: ${this.cacheMisses})`);
      return cached.data as T;
    }
    
    this.cacheMisses++;
    console.log(`[MikroTik] Cache MISS for ${key} (hits: ${this.cacheHits}, misses: ${this.cacheMisses})`);
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: now, ttl });
    return data;
  }
  
  /**
   * Clear cache for specific key or all
   */
  private clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  /**
   * Health check - returns connection status
   */
  public async healthCheck(): Promise<HealthStatus> {
    const config = this.loadConfig();
    
    // Try to refresh identity if connected (with caching)
    if (this.isConnected) {
      try {
        this.routerIdentity = await this.getCached(
          'router-identity',
          () => this.getIdentity(),
          30000 // Cache identity for 30 seconds
        );
      } catch (error) {
        // Identity fetch failed, but connection might still be valid
      }
    }
    
    return {
      connected: this.isConnected,
      connectedSince: this.connectedSince ? this.connectedSince.toISOString() : null,
      lastError: this.lastError,
      routerIdentity: this.routerIdentity,
      host: config.host,
      port: config.port,
    };
  }

  /**
   * Get router status (formatted for frontend) - with caching
   */
  async getRouterStatus(): Promise<RouterStatus> {
    return this.getCached(
      'router-status',
      async () => {
        try {
          const config = this.loadConfig(); // Ensure config is loaded

          const [resources, identity, routerboard, interfaces, ipAddresses] = await Promise.all([
            this.executeCommand('/system/resource/print'),
            this.executeCommand('/system/identity/print'),
            this.executeCommand('/system/routerboard/print').catch(() => [{}]),
            this.executeCommand('/interface/print').catch(() => []),
            this.executeCommand('/ip/address/print').catch(() => []),
          ]);

      const resourceData = resources[0] || {};
      const identityData = identity[0] || {};
      const routerboardData = routerboard[0] || {};

      // Get first interface MAC address
      const firstInterface = interfaces.find((iface: any) => iface['mac-address']) || {};
      const macAddress = firstInterface['mac-address'];

      // Get CIDR notation from first IP address (e.g., "/24" from "192.168.88.1/24")
      const firstIp = ipAddresses[0] || {};
      const fullAddress = firstIp.address || firstIp.network || '';
      const subnet = fullAddress.includes('/') ? '/' + fullAddress.split('/')[1] : '';

      // Parse uptime (format: 1w2d3h4m5s)
      const uptime = this.parseUptime(resourceData.uptime || '0s');

      // Parse memory
      const totalMemory = this.parseBytes(resourceData['total-memory'] || '0');
      const freeMemory = this.parseBytes(resourceData['free-memory'] || '0');
      const usedMemory = totalMemory - freeMemory;

      // Parse CPU load (remove % if present)
      const cpuLoad = parseInt(String(resourceData['cpu-load'] || '0').replace('%', ''));

          return {
            name: identityData.name || 'MikroTik',
            ip: config.host,
            model: routerboardData.model || resourceData['board-name'] || 'Unknown',
            version: resourceData.version || 'Unknown',
            status: 'online',
            cpuLoad,
            memoryUsed: usedMemory,
            memoryTotal: totalMemory,
            uptime,
            timestamp: new Date().toISOString(),
            macAddress,
            subnet,
          };
        } catch (error) {
          console.error('[MikroTik] Error getting router status:', error);
          throw error;
        }
      },
      3000 // Cache for 3 seconds
    );
  }

  /**
   * Get network interfaces (formatted for frontend) - with caching
   */
  async getInterfaces(): Promise<NetworkInterface[]> {
    return this.getCached(
      'interfaces',
      async () => {
        try {
          const interfaces = await this.executeCommand('/interface/print');
      
          return interfaces.map((iface: any, index: number) => ({
            id: iface['.id'] || `iface-${index}`,
            name: iface.name || 'unknown',
            type: iface.type || 'unknown',
            status: (iface.running === 'true' || iface.disabled === 'false') ? 'up' : 'down',
            rxRate: parseInt(iface['rx-rate'] || '0'),
            txRate: parseInt(iface['tx-rate'] || '0'),
            rxBytes: parseInt(iface['rx-byte'] || '0'),
            txBytes: parseInt(iface['tx-byte'] || '0'),
            comment: iface.comment,
          }));
        } catch (error) {
          console.error('Error getting interfaces:', error);
          throw error;
        }
      },
      5000 // Cache interfaces for 5 seconds
    );
  }

  /**
   * Convert terminal command format to RouterOS API format
   * Example: "/ip address print" -> "/ip/address/print"
   * Example: "/interface print where name=ether1" -> "/interface/print where name=ether1"
   */
  private convertCommandFormat(command: string): string {
    // Trim whitespace
    command = command.trim();

    // If command doesn't start with /, it's invalid
    if (!command.startsWith('/')) {
      throw new Error('Commands must start with /');
    }

    // Find where parameters start (keywords like 'where', '=', or other flags)
    const paramKeywords = ['where', 'from', 'to'];
    let paramStartIndex = -1;

    for (const keyword of paramKeywords) {
      const index = command.indexOf(` ${keyword} `);
      if (index !== -1 && (paramStartIndex === -1 || index < paramStartIndex)) {
        paramStartIndex = index;
      }
    }

    // Also check for = sign which indicates a parameter
    const equalsIndex = command.indexOf('=');
    if (equalsIndex !== -1) {
      // Find the space before the parameter with =
      const spaceBeforeEquals = command.lastIndexOf(' ', equalsIndex);
      if (spaceBeforeEquals !== -1 && (paramStartIndex === -1 || spaceBeforeEquals < paramStartIndex)) {
        paramStartIndex = spaceBeforeEquals;
      }
    }

    let commandPath: string;
    let params: string;

    if (paramStartIndex !== -1) {
      // Split into command path and parameters
      commandPath = command.substring(0, paramStartIndex);
      params = command.substring(paramStartIndex);
    } else {
      // No parameters, entire command is the path
      commandPath = command;
      params = '';
    }

    // Convert command path: replace spaces with slashes
    const convertedPath = commandPath.replace(/\s+/g, '/');

    // Rejoin with parameters
    const fullCommand = params ? `${convertedPath}${params}` : convertedPath;

    console.log(`[MikroTik] Command conversion: "${command}" -> "${fullCommand}"`);
    return fullCommand;
  }

  /**
   * Execute terminal command and format output
   */
  async executeTerminalCommand(command: string): Promise<string> {
    try {
      // Convert command format for RouterOS API
      const apiCommand = this.convertCommandFormat(command);

      const result = await this.executeCommand(apiCommand);

      // Format the result as a readable string
      if (!result || result.length === 0) {
        return 'Command executed successfully (no output)';
      }

      // Convert result array to formatted string
      return result.map((item: any) => {
        if (typeof item === 'string') return item;

        // Format object as key-value pairs
        return Object.entries(item)
          .filter(([key]) => !key.startsWith('.'))
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
      }).join('\n\n');
    } catch (error: any) {
      console.error('Error executing terminal command:', error);
      throw new Error(error.message || 'Command execution failed');
    }
  }

  /**
   * Parse uptime string to seconds (public for route access)
   */
  public parseUptime(uptime: string): number {
    let seconds = 0;
    const weeks = uptime.match(/(\d+)w/);
    const days = uptime.match(/(\d+)d/);
    const hours = uptime.match(/(\d+)h/);
    const minutes = uptime.match(/(\d+)m/);
    const secs = uptime.match(/(\d+)s/);

    if (weeks) seconds += parseInt(weeks[1]) * 604800;
    if (days) seconds += parseInt(days[1]) * 86400;
    if (hours) seconds += parseInt(hours[1]) * 3600;
    if (minutes) seconds += parseInt(minutes[1]) * 60;
    if (secs) seconds += parseInt(secs[1]);

    return seconds;
  }

  /**
   * Parse memory string to bytes (public for route access)
   */
  public parseBytes(memory: string | number): number {
    if (typeof memory === 'number') return memory;
    const memoryStr = String(memory);
    const value = parseFloat(memoryStr);
    if (memoryStr.includes('KiB')) return value * 1024;
    if (memoryStr.includes('MiB')) return value * 1024 * 1024;
    if (memoryStr.includes('GiB')) return value * 1024 * 1024 * 1024;
    return value;
  }

  /**
   * Check connection status
   */
  public isConnectionActive(): boolean {
    return this.isConnected && this.connection !== null;
  }
}

// Export singleton accessor
export const mikrotikService = MikroTikService.getInstance();
export default mikrotikService;
