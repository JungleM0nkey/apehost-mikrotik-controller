import { RouterOSAPI } from 'node-routeros';
import { configManager } from './config-manager.js';
import { PlainTerminalFormatter, SYMBOLS } from '../utils/terminal-formatter-plain.js';

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
  ipAddress?: string;
  bridge?: string; // Name of bridge this interface belongs to
  isBridge?: boolean; // True if this interface is a bridge
  bridgePorts?: string[]; // For bridge interfaces, list of member port names
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
  private requestQueue: Array<{resolve: Function; reject: Function; command: string; params?: Record<string, any>}> = [];
  private isProcessingQueue: boolean = false;
  
  // Cache system
  private cache: Map<string, {data: any; timestamp: number; ttl: number}> = new Map();
  private defaultCacheTTL: number = 5000; // 5 seconds default
  
  // Terminal formatting
  private formatter: PlainTerminalFormatter = new PlainTerminalFormatter();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  // Rate calculation system
  private previousInterfaceStats: Map<string, {rxBytes: number; txBytes: number; timestamp: number}> = new Map();

  // Rate smoothing system (EMA - Exponential Moving Average)
  private smoothedRates: Map<string, {rxRate: number; txRate: number}> = new Map();
  private readonly EMA_ALPHA = 0.4; // Smoothing factor: 0.4 balances responsiveness vs stability

  private constructor() {
    // Lazy initialization - config loaded on first use
  }

  public static getInstance(): MikroTikService {
    if (!MikroTikService.instance) {
      MikroTikService.instance = new MikroTikService();
    }
    return MikroTikService.instance;
  }

  private async loadConfig(): Promise<MikroTikConfig> {
    if (!this.config) {
      const mikrotikConfig = await configManager.getMikroTikConfig();

      if (!mikrotikConfig.host) {
        throw new Error('MikroTik host is required in settings');
      }

      this.config = {
        host: mikrotikConfig.host,
        port: mikrotikConfig.port,
        user: mikrotikConfig.username,
        password: mikrotikConfig.password,
        timeout: mikrotikConfig.timeout,
        keepaliveInterval: mikrotikConfig.keepaliveInterval,
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
      const config = await this.loadConfig();
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
   * Refresh connection with new configuration from settings
   * Call this after updating MikroTik settings via web UI
   */
  public async refreshConnection(): Promise<boolean> {
    console.log('[MikroTik] Refreshing connection with new configuration...');

    // Clear cached config
    this.config = null;

    // Disconnect current connection
    await this.disconnect('Settings updated');

    // Clear cache
    this.clearCache();

    // Reset reconnect attempts
    this.reconnectAttempts = 0;

    // Reconnect with new config
    try {
      await this.connect();
      console.log('[MikroTik] Connection refreshed successfully');
      return true;
    } catch (error: any) {
      console.error('[MikroTik] Failed to refresh connection:', error.message);
      return false;
    }
  }

  /**
   * Start keepalive pings
   */
  private startKeepalive(): void {
    this.stopKeepalive();

    // Use cached config (already loaded by connect())
    if (!this.config) {
      console.warn('[MikroTik] Cannot start keepalive: config not loaded');
      return;
    }

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
    }, this.config.keepaliveInterval);
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
  async executeCommand(command: string, params?: Record<string, any>): Promise<any[]> {
    await this.ensureConnected();

    // Queue the request
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, command, params });
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
        let result;
        if (request.params) {
          // Convert params object to RouterOS command format: ['/command', '=key=value', ...]
          const commandArray = [
            request.command,
            ...Object.entries(request.params).map(([key, value]) => `=${key}=${value}`)
          ];
          result = await this.connection!.write(commandArray);
        } else {
          result = await this.connection!.write(request.command);
        }
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
    const config = await this.loadConfig();

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
          const config = await this.loadConfig(); // Ensure config is loaded

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

      // Get CPU architecture and count
      const cpuArchitecture = resourceData['architecture-name'] || resourceData.architecture || 'Unknown';
      const cpuCount = parseInt(String(resourceData['cpu-count'] || resourceData.cpu || '1'));

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
            cpuArchitecture,
            cpuCount,
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
   * Get network interfaces (formatted for frontend) - with caching disabled for rate calculation
   */
  async getInterfaces(): Promise<NetworkInterface[]> {
    try {
      // Get interface list - NO CACHING to get fresh byte counts for rate calculation
      const interfaces = await this.executeCommand('/interface/print');
      const currentTimestamp = Date.now();

      // Get IP addresses to associate with interfaces
      let ipAddresses: any[] = [];
      try {
        ipAddresses = await this.getIpAddresses();
      } catch (error) {
        console.warn('Failed to fetch IP addresses for interfaces:', error);
      }

      // Get bridge port information to identify which interfaces are bridge members
      let bridgePorts: any[] = [];
      try {
        bridgePorts = await this.executeCommand('/interface/bridge/port/print');
      } catch (error) {
        console.warn('Failed to fetch bridge port information:', error);
      }

      // Build a map of interface -> bridge and bridge -> ports
      const interfaceToBridge = new Map<string, string>();
      const bridgeToPorts = new Map<string, string[]>();

      bridgePorts.forEach((port: any) => {
        const interfaceName = port.interface;
        const bridgeName = port.bridge;
        
        if (interfaceName && bridgeName) {
          interfaceToBridge.set(interfaceName, bridgeName);
          
          if (!bridgeToPorts.has(bridgeName)) {
            bridgeToPorts.set(bridgeName, []);
          }
          bridgeToPorts.get(bridgeName)!.push(interfaceName);
        }
      });

      return interfaces.map((iface: any, index: number) => {
        const ifaceName = iface.name || 'unknown';
        const currentRxBytes = parseInt(iface['rx-byte'] || '0');
        const currentTxBytes = parseInt(iface['tx-byte'] || '0');

        // Calculate rates from previous measurements
        let rawRxRate = 0;
        let rawTxRate = 0;

        const previous = this.previousInterfaceStats.get(ifaceName);
        if (previous) {
          const timeDelta = (currentTimestamp - previous.timestamp) / 1000; // seconds

          if (timeDelta > 0) {
            // Calculate raw bytes per second
            rawRxRate = Math.max(0, (currentRxBytes - previous.rxBytes) / timeDelta);
            rawTxRate = Math.max(0, (currentTxBytes - previous.txBytes) / timeDelta);
          }
        }

        // Apply EMA smoothing to reduce jitter from timing variance
        let rxRate = rawRxRate;
        let txRate = rawTxRate;

        const previousSmoothed = this.smoothedRates.get(ifaceName);
        if (previousSmoothed && previous) {
          // EMA formula: smoothed = (alpha * current) + ((1 - alpha) * previous_smoothed)
          rxRate = (this.EMA_ALPHA * rawRxRate) + ((1 - this.EMA_ALPHA) * previousSmoothed.rxRate);
          txRate = (this.EMA_ALPHA * rawTxRate) + ((1 - this.EMA_ALPHA) * previousSmoothed.txRate);
        }

        // Store smoothed rates for next calculation
        this.smoothedRates.set(ifaceName, {
          rxRate,
          txRate
        });

        // Store current values for next calculation
        this.previousInterfaceStats.set(ifaceName, {
          rxBytes: currentRxBytes,
          txBytes: currentTxBytes,
          timestamp: currentTimestamp
        });

        // Find IP address for this interface
        const ipAddr = ipAddresses.find(addr => addr.interface === ifaceName);

        // Determine if this is a bridge and what its relationship is
        const isBridge = iface.type === 'bridge';
        const bridgeName = interfaceToBridge.get(ifaceName);
        const bridgePorts = isBridge ? bridgeToPorts.get(ifaceName) : undefined;

        return {
          id: iface['.id'] || `iface-${index}`,
          name: ifaceName,
          type: iface.type || 'unknown',
          status: (iface.running === 'true' || iface.disabled === 'false') ? 'up' : 'down',
          rxRate, // bytes per second (calculated from delta)
          txRate, // bytes per second (calculated from delta)
          rxBytes: currentRxBytes,
          txBytes: currentTxBytes,
          comment: iface.comment,
          ipAddress: ipAddr ? ipAddr.address : undefined,
          bridge: bridgeName,
          isBridge,
          bridgePorts,
        };
      });
    } catch (error) {
      console.error('Error getting interfaces:', error);
      throw error;
    }
  }

  /**
   * Update network interface properties
   */
  async updateInterface(
    id: string,
    updates: { name?: string; comment?: string; disabled?: boolean }
  ): Promise<NetworkInterface> {
    try {
      console.log('updateInterface called with:', { id, updates });

      const params: Record<string, string> = {
        '.id': id
      };

      if (updates.name !== undefined) {
        params['name'] = updates.name;
      }
      if (updates.comment !== undefined) {
        params['comment'] = updates.comment;
      }
      if (updates.disabled !== undefined) {
        params['disabled'] = updates.disabled ? 'yes' : 'no';
      }

      // Check if there are any updates besides .id
      if (Object.keys(params).length === 1) {
        throw new Error('No updates provided');
      }

      console.log('Executing MikroTik command:', '/interface/set', params);

      // Execute the set command with params object
      await this.executeCommand('/interface/set', params);
      console.log('Command executed successfully');

      // Clear cache to force refresh
      this.clearCache('interfaces');

      // Get updated interface list
      const interfaces = await this.getInterfaces();
      const updatedInterface = interfaces.find(iface => iface.id === id);

      if (!updatedInterface) {
        throw new Error('Interface not found after update');
      }

      console.log('Interface updated successfully:', updatedInterface);
      return updatedInterface;
    } catch (error) {
      console.error('Error updating interface:', error);
      throw error;
    }
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
   * Colorize value based on type detection
   */
  private colorizeValue(key: string, value: any): string {
    // Use the enhanced formatter's colorization
    return this.formatter.keyValue(key, value, 0).split(' : ')[1] || String(value);
  }

  /**
   * Format single item output with aligned key-value pairs
   */
  private formatSingleItem(item: any): string {
    if (typeof item === 'string') return item;

    const entries = Object.entries(item).filter(([key]) => !key.startsWith('.'));
    if (entries.length === 0) return this.formatter.status('No data available', 'warning');

    // Calculate max key length for alignment
    const maxKeyLength = Math.max(...entries.map(([key]) => key.length));

    const formattedEntries = entries.map(([key, value]) => {
      return this.formatter.keyValue(key, value, maxKeyLength + 2);
    }).join('\n');

    return formattedEntries;
  }

  /**
   * Format multiple items with section separators
   */
  private formatMultipleItems(items: any[]): string {
    if (items.length === 0) {
      return this.formatter.status('No items found', 'info');
    }

    return items.map((item, index) => {
      const header = this.formatter.header(`${SYMBOLS.DIAMOND} Item ${index + 1}`, 60);
      const content = this.formatSingleItem(item);
      return `${header}\n${content}`;
    }).join('\n\n');
  }

  /**
   * Execute terminal command and format output
   */
  async executeTerminalCommand(command: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Convert command format for RouterOS API
      const apiCommand = this.convertCommandFormat(command);

      const result = await this.executeCommand(apiCommand);
      const executionTime = Date.now() - startTime;

      // Create command summary header
      const commandSummary = this.formatter.commandSummary(command, executionTime, true);

      // Format the result as a readable string
      if (!result || result.length === 0) {
        return `${commandSummary}\n\n${this.formatter.status('Command executed successfully (no output)', 'success')}`;
      }

      let formattedOutput: string;
      
      // Format based on number of items
      if (result.length === 1) {
        formattedOutput = this.formatSingleItem(result[0]);
      } else {
        const itemCountHeader = this.formatter.status(`Found ${result.length} items`, 'info');
        formattedOutput = `${itemCountHeader}\n\n${this.formatMultipleItems(result)}`;
      }

      return `${commandSummary}\n\n${formattedOutput}`;
      
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const commandSummary = this.formatter.commandSummary(command, executionTime, false);
      
      console.error('Error executing terminal command:', error);
      
      const errorMessage = this.formatter.status(
        `Command failed: ${error.message || 'Unknown error'}`, 
        'error'
      );
      
      return `${commandSummary}\n\n${errorMessage}`;
    }
  }

  /**
   * Export router configuration
   */
  async exportConfig(): Promise<string> {
    try {
      const result = await this.executeCommand('/export');

      if (!result || result.length === 0) {
        throw new Error('No configuration data received');
      }

      // The export command typically returns the configuration as a single string
      // or as an array with the configuration split into parts
      if (Array.isArray(result)) {
        return result.join('\n');
      }

      return String(result);
    } catch (error) {
      console.error('Error exporting configuration:', error);
      throw error;
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
   * Get IP addresses
   */
  async getIpAddresses(): Promise<any[]> {
    if (!this.isConnectionActive()) {
      return this.getMockIpAddresses();
    }

    try {
      const result = await this.executeCommand('/ip/address/print');
      
      return result.map((addr: any, index: number) => ({
        id: addr['.id'] || `*${index}`,
        address: addr.address || '',
        network: addr.network || '',
        interface: addr.interface || '',
        status: addr.disabled ? 'inactive' : 'active',
        dynamic: addr.dynamic === 'true',
        disabled: addr.disabled === 'true',
        invalid: addr.invalid === 'true',
        comment: addr.comment || ''
      }));
    } catch (error) {
      console.error('Failed to fetch IP addresses:', error);
      return this.getMockIpAddresses();
    }
  }

  /**
   * Get routes
   */
  async getRoutes(): Promise<any[]> {
    if (!this.isConnectionActive()) {
      return this.getMockRoutes();
    }

    try {
      const result = await this.executeCommand('/ip/route/print');
      
      return result.map((route: any, index: number) => ({
        id: route['.id'] || `*${index}`,
        dstAddress: route['dst-address'] || '0.0.0.0/0',
        gateway: route.gateway || '',
        gatewayStatus: route['gateway-status'] || 'reachable',
        distance: parseInt(route.distance || '1'),
        scope: parseInt(route.scope || '30'),
        targetScope: parseInt(route['target-scope'] || '10'),
        interface: route.interface || '',
        dynamic: route.dynamic === 'true',
        active: route.active === 'true',
        static: route.static === 'true',
        comment: route.comment || ''
      }));
    } catch (error) {
      console.error('Failed to fetch routes:', error);
      return this.getMockRoutes();
    }
  }

  /**
   * Get ARP table
   */
  async getArpTable(): Promise<any[]> {
    if (!this.isConnectionActive()) {
      return this.getMockArpTable();
    }

    try {
      const result = await this.executeCommand('/ip/arp/print');
      
      return result.map((arp: any, index: number) => ({
        id: arp['.id'] || `*${index}`,
        address: arp.address || '',
        macAddress: arp['mac-address'] || '',
        interface: arp.interface || '',
        status: arp.status || 'reachable',
        dynamic: arp.dynamic === 'true',
        published: arp.published === 'true',
        invalid: arp.invalid === 'true',
        dhcp: arp.DHCP === 'true',
        complete: arp.complete === 'true',
        disabled: arp.disabled === 'true',
        comment: arp.comment || ''
      }));
    } catch (error) {
      console.error('Failed to fetch ARP table:', error);
      return this.getMockArpTable();
    }
  }

  /**
   * Mock IP addresses for development
   */
  private getMockIpAddresses(): any[] {
    return [
      {
        id: '*1',
        address: '192.168.88.1/24',
        network: '192.168.88.0',
        interface: 'ether1',
        status: 'active',
        dynamic: false,
        disabled: false,
        invalid: false,
        comment: 'LAN Network'
      },
      {
        id: '*2',
        address: '10.0.0.1/8',
        network: '10.0.0.0',
        interface: 'ether2',
        status: 'active',
        dynamic: false,
        disabled: false,
        invalid: false,
        comment: 'WAN Interface'
      },
      {
        id: '*3',
        address: '192.168.100.1/24',
        network: '192.168.100.0',
        interface: 'bridge1',
        status: 'active',
        dynamic: true,
        disabled: false,
        invalid: false,
        comment: ''
      }
    ];
  }

  /**
   * Mock routes for development
   */
  private getMockRoutes(): any[] {
    return [
      {
        id: '*1',
        dstAddress: '0.0.0.0/0',
        gateway: '10.0.0.254',
        gatewayStatus: 'reachable',
        distance: 1,
        scope: 30,
        targetScope: 10,
        interface: 'ether2',
        dynamic: false,
        active: true,
        static: true,
        comment: 'Default Route'
      },
      {
        id: '*2',
        dstAddress: '192.168.88.0/24',
        gateway: '192.168.88.1',
        gatewayStatus: 'reachable',
        distance: 0,
        scope: 10,
        targetScope: 10,
        interface: 'ether1',
        dynamic: true,
        active: true,
        static: false,
        comment: ''
      },
      {
        id: '*3',
        dstAddress: '10.0.0.0/8',
        gateway: '10.0.0.1',
        gatewayStatus: 'reachable',
        distance: 0,
        scope: 10,
        targetScope: 10,
        interface: 'ether2',
        dynamic: true,
        active: true,
        static: false,
        comment: ''
      }
    ];
  }

  /**
   * Mock ARP table for development
   */
  private getMockArpTable(): any[] {
    return [
      {
        id: '*1',
        address: '192.168.88.10',
        macAddress: '00:11:22:33:44:55',
        interface: 'ether1',
        status: 'reachable',
        dynamic: true,
        published: false,
        invalid: false,
        dhcp: true,
        complete: true,
        disabled: false,
        comment: 'Desktop PC'
      },
      {
        id: '*2',
        address: '192.168.88.20',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        interface: 'ether1',
        status: 'reachable',
        dynamic: true,
        published: false,
        invalid: false,
        dhcp: true,
        complete: true,
        disabled: false,
        comment: 'Laptop'
      },
      {
        id: '*3',
        address: '192.168.88.50',
        macAddress: '11:22:33:44:55:66',
        interface: 'ether1',
        status: 'stale',
        dynamic: true,
        published: false,
        invalid: false,
        dhcp: false,
        complete: true,
        disabled: false,
        comment: 'Printer'
      },
      {
        id: '*4',
        address: '10.0.0.254',
        macAddress: 'FF:EE:DD:CC:BB:AA',
        interface: 'ether2',
        status: 'reachable',
        dynamic: false,
        published: false,
        invalid: false,
        dhcp: false,
        complete: true,
        disabled: false,
        comment: 'Gateway'
      }
    ];
  }

  /**
   * Check connection status
   */
  public isConnectionActive(): boolean {
    return this.isConnected && this.connection !== null;
  }

  /**
   * Get firewall filter rules
   */
  async getFirewallFilterRules(): Promise<any[]> {
    if (!this.isConnectionActive()) {
      return this.getMockFirewallFilterRules();
    }

    try {
      const result = await this.executeCommand('/ip/firewall/filter/print');

      return result.map((rule: any, index: number) => ({
        id: rule['.id'] || `*${index}`,
        chain: rule.chain || '',
        action: rule.action || '',
        protocol: rule.protocol,
        srcAddress: rule['src-address'],
        dstAddress: rule['dst-address'],
        srcPort: rule['src-port'],
        dstPort: rule['dst-port'],
        inInterface: rule['in-interface'],
        outInterface: rule['out-interface'],
        bytes: parseInt(rule.bytes || '0'),
        packets: parseInt(rule.packets || '0'),
        disabled: rule.disabled === 'true',
        invalid: rule.invalid === 'true',
        dynamic: rule.dynamic === 'true',
        comment: rule.comment || ''
      }));
    } catch (error) {
      console.error('Failed to fetch firewall filter rules:', error);
      return this.getMockFirewallFilterRules();
    }
  }

  /**
   * Get firewall NAT rules
   */
  async getFirewallNatRules(): Promise<any[]> {
    if (!this.isConnectionActive()) {
      return this.getMockFirewallNatRules();
    }

    try {
      const result = await this.executeCommand('/ip/firewall/nat/print');

      return result.map((rule: any, index: number) => ({
        id: rule['.id'] || `*${index}`,
        chain: rule.chain || '',
        action: rule.action || '',
        protocol: rule.protocol,
        srcAddress: rule['src-address'],
        dstAddress: rule['dst-address'],
        srcPort: rule['src-port'],
        dstPort: rule['dst-port'],
        toAddresses: rule['to-addresses'],
        toPorts: rule['to-ports'],
        inInterface: rule['in-interface'],
        outInterface: rule['out-interface'],
        bytes: parseInt(rule.bytes || '0'),
        packets: parseInt(rule.packets || '0'),
        disabled: rule.disabled === 'true',
        invalid: rule.invalid === 'true',
        dynamic: rule.dynamic === 'true',
        comment: rule.comment || ''
      }));
    } catch (error) {
      console.error('Failed to fetch firewall NAT rules:', error);
      return this.getMockFirewallNatRules();
    }
  }

  /**
   * Get firewall mangle rules
   */
  async getFirewallMangleRules(): Promise<any[]> {
    if (!this.isConnectionActive()) {
      return this.getMockFirewallMangleRules();
    }

    try {
      const result = await this.executeCommand('/ip/firewall/mangle/print');

      return result.map((rule: any, index: number) => ({
        id: rule['.id'] || `*${index}`,
        chain: rule.chain || '',
        action: rule.action || '',
        protocol: rule.protocol,
        srcAddress: rule['src-address'],
        dstAddress: rule['dst-address'],
        newRoutingMark: rule['new-routing-mark'],
        newPacketMark: rule['new-packet-mark'],
        passthroughEnabled: rule.passthrough === 'true',
        bytes: parseInt(rule.bytes || '0'),
        packets: parseInt(rule.packets || '0'),
        disabled: rule.disabled === 'true',
        invalid: rule.invalid === 'true',
        dynamic: rule.dynamic === 'true',
        comment: rule.comment || ''
      }));
    } catch (error) {
      console.error('Failed to fetch firewall mangle rules:', error);
      return this.getMockFirewallMangleRules();
    }
  }

  /**
   * Get firewall address lists
   */
  async getFirewallAddressLists(): Promise<any[]> {
    if (!this.isConnectionActive()) {
      return this.getMockFirewallAddressLists();
    }

    try {
      const result = await this.executeCommand('/ip/firewall/address-list/print');

      return result.map((entry: any, index: number) => ({
        id: entry['.id'] || `*${index}`,
        list: entry.list || '',
        address: entry.address || '',
        creationTime: entry['creation-time'],
        timeout: entry.timeout,
        dynamic: entry.dynamic === 'true',
        disabled: entry.disabled === 'true',
        comment: entry.comment || ''
      }));
    } catch (error) {
      console.error('Failed to fetch firewall address lists:', error);
      return this.getMockFirewallAddressLists();
    }
  }

  /**
   * Mock firewall filter rules for development
   */
  private getMockFirewallFilterRules(): any[] {
    return [
      {
        id: '*1',
        chain: 'input',
        action: 'accept',
        protocol: 'tcp',
        dstPort: '22',
        inInterface: 'ether1',
        bytes: 1234567,
        packets: 4321,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Allow SSH from LAN'
      },
      {
        id: '*2',
        chain: 'input',
        action: 'drop',
        protocol: 'tcp',
        srcAddress: '!192.168.88.0/24',
        dstPort: '8291',
        bytes: 0,
        packets: 0,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Block external Winbox access'
      },
      {
        id: '*3',
        chain: 'forward',
        action: 'accept',
        protocol: 'icmp',
        bytes: 98765,
        packets: 123,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Allow ICMP'
      },
      {
        id: '*4',
        chain: 'input',
        action: 'accept',
        srcAddress: '192.168.88.0/24',
        bytes: 567890,
        packets: 890,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Allow LAN to Router'
      },
      {
        id: '*5',
        chain: 'input',
        action: 'drop',
        bytes: 123,
        packets: 5,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Drop all other input'
      }
    ];
  }

  /**
   * Mock firewall NAT rules for development
   */
  private getMockFirewallNatRules(): any[] {
    return [
      {
        id: '*1',
        chain: 'srcnat',
        action: 'masquerade',
        outInterface: 'ether2',
        bytes: 9876543,
        packets: 12345,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Masquerade to WAN'
      },
      {
        id: '*2',
        chain: 'dstnat',
        action: 'dst-nat',
        protocol: 'tcp',
        dstPort: '80',
        toAddresses: '192.168.88.10',
        toPorts: '80',
        inInterface: 'ether2',
        bytes: 456789,
        packets: 789,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Port forward HTTP to web server'
      },
      {
        id: '*3',
        chain: 'dstnat',
        action: 'dst-nat',
        protocol: 'tcp',
        dstPort: '443',
        toAddresses: '192.168.88.10',
        toPorts: '443',
        inInterface: 'ether2',
        bytes: 345678,
        packets: 567,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Port forward HTTPS to web server'
      }
    ];
  }

  /**
   * Mock firewall mangle rules for development
   */
  private getMockFirewallMangleRules(): any[] {
    return [
      {
        id: '*1',
        chain: 'prerouting',
        action: 'mark-routing',
        srcAddress: '192.168.88.0/24',
        newRoutingMark: 'LAN_MARK',
        passthroughEnabled: true,
        bytes: 234567,
        packets: 345,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Mark LAN traffic'
      },
      {
        id: '*2',
        chain: 'prerouting',
        action: 'mark-packet',
        protocol: 'tcp',
        dstPort: '80,443',
        newPacketMark: 'HTTP_MARK',
        passthroughEnabled: true,
        bytes: 123456,
        packets: 234,
        disabled: false,
        invalid: false,
        dynamic: false,
        comment: 'Mark HTTP/HTTPS packets'
      }
    ];
  }

  /**
   * Mock firewall address lists for development
   */
  private getMockFirewallAddressLists(): any[] {
    return [
      {
        id: '*1',
        list: 'whitelist',
        address: '192.168.88.100',
        dynamic: false,
        disabled: false,
        comment: 'Admin workstation'
      },
      {
        id: '*2',
        list: 'whitelist',
        address: '192.168.88.101',
        dynamic: false,
        disabled: false,
        comment: 'Management server'
      },
      {
        id: '*3',
        list: 'blacklist',
        address: '10.20.30.40',
        dynamic: true,
        disabled: false,
        comment: 'Blocked IP - suspicious activity'
      },
      {
        id: '*4',
        list: 'vpn_clients',
        address: '10.10.10.5',
        dynamic: false,
        disabled: false,
        comment: 'VPN Client 1'
      },
      {
        id: '*5',
        list: 'vpn_clients',
        address: '10.10.10.6',
        dynamic: false,
        disabled: false,
        comment: 'VPN Client 2'
      }
    ];
  }

  /**
   * Get DHCP server leases
   * Provides hostname and additional client information
   */
  async getDhcpLeases(): Promise<any[]> {
    if (!this.isConnectionActive()) {
      return this.getMockDhcpLeases();
    }

    try {
      const result = await this.executeCommand('/ip/dhcp-server/lease/print');

      return result.map((lease: any, index: number) => ({
        id: lease['.id'] || `*${index}`,
        address: lease.address || '',
        macAddress: lease['mac-address'] || '',
        hostname: lease['host-name'] || '',
        status: lease.status || 'waiting',
        expiresAfter: lease['expires-after'] || '',
        lastSeen: lease['last-seen'] || '',
        server: lease.server || '',
        dynamic: lease.dynamic === 'true',
        blocked: lease.blocked === 'true',
        disabled: lease.disabled === 'true',
        comment: lease.comment || ''
      }));
    } catch (error) {
      console.error('Failed to fetch DHCP leases:', error);
      return this.getMockDhcpLeases();
    }
  }

  /**
   * Get neighbor devices (LLDP/CDP/MNDP)
   * Discovers network devices like switches, routers, access points
   */
  async getNeighbors(): Promise<any[]> {
    if (!this.isConnectionActive()) {
      return this.getMockNeighbors();
    }

    try {
      const result = await this.executeCommand('/ip/neighbor/print');

      return result.map((neighbor: any, index: number) => ({
        id: neighbor['.id'] || `*${index}`,
        interface: neighbor.interface || '',
        address: neighbor.address || '',
        address6: neighbor['address6'] || '',
        macAddress: neighbor['mac-address'] || '',
        identity: neighbor.identity || '',
        platform: neighbor.platform || '',
        version: neighbor.version || '',
        board: neighbor.board || '',
        uptime: neighbor.uptime || '',
        softwareId: neighbor['software-id'] || '',
        interfaceName: neighbor['interface-name'] || '',
        system: neighbor.system || '',
        discoveredBy: neighbor['discovered-by'] || ''
      }));
    } catch (error) {
      console.error('Failed to fetch neighbors:', error);
      return this.getMockNeighbors();
    }
  }

  /**
   * Perform comprehensive network scan
   * Combines ARP, DHCP leases, and neighbor discovery for complete network view
   */
  async performNetworkScan(): Promise<{
    arpTable: any[];
    dhcpLeases: any[];
    neighbors: any[];
    enhancedHosts: any[];
    scanTime: string;
  }> {
    const scanStartTime = Date.now();

    try {
      // Fetch all data in parallel for speed
      const [arpTable, dhcpLeases, neighbors] = await Promise.all([
        this.getArpTable(),
        this.getDhcpLeases(),
        this.getNeighbors()
      ]);

      // Create enhanced host list by combining data
      const enhancedHosts = this.enhanceHostData(arpTable, dhcpLeases, neighbors);

      const scanDuration = Date.now() - scanStartTime;

      return {
        arpTable,
        dhcpLeases,
        neighbors,
        enhancedHosts,
        scanTime: new Date().toISOString()
      };
    } catch (error) {
      console.error('Network scan failed:', error);
      throw error;
    }
  }

  /**
   * Enhance host data by combining ARP, DHCP, and neighbor information
   */
  private enhanceHostData(arpTable: any[], dhcpLeases: any[], neighbors: any[]): any[] {
    const enhancedHosts: any[] = [];
    const processedMacs = new Set<string>();

    // Start with ARP entries as the base
    arpTable.forEach(arp => {
      const mac = arp.macAddress.toLowerCase();
      if (processedMacs.has(mac)) return;
      processedMacs.add(mac);

      // Find matching DHCP lease
      const dhcpLease = dhcpLeases.find(
        lease => lease.macAddress.toLowerCase() === mac
      );

      // Find matching neighbor
      const neighbor = neighbors.find(
        n => n.macAddress.toLowerCase() === mac
      );

      enhancedHosts.push({
        id: arp.id,
        address: arp.address,
        macAddress: arp.macAddress,
        interface: arp.interface,
        arpStatus: arp.status,
        hostname: dhcpLease?.hostname || '',
        dhcpStatus: dhcpLease?.status || '',
        dhcpServer: dhcpLease?.server || '',
        expiresAfter: dhcpLease?.expiresAfter || '',
        lastSeen: dhcpLease?.lastSeen || '',
        isNeighborDevice: !!neighbor,
        neighborIdentity: neighbor?.identity || '',
        neighborPlatform: neighbor?.platform || '',
        neighborVersion: neighbor?.version || '',
        discoveredBy: neighbor?.discoveredBy || '',
        dynamic: arp.dynamic,
        complete: arp.complete,
        disabled: arp.disabled,
        comment: arp.comment || dhcpLease?.comment || ''
      });
    });

    // Add DHCP leases that don't have ARP entries yet
    dhcpLeases.forEach(lease => {
      const mac = lease.macAddress.toLowerCase();
      if (processedMacs.has(mac)) return;
      processedMacs.add(mac);

      const neighbor = neighbors.find(
        n => n.macAddress.toLowerCase() === mac
      );

      enhancedHosts.push({
        id: lease.id,
        address: lease.address,
        macAddress: lease.macAddress,
        interface: '',
        arpStatus: 'unknown',
        hostname: lease.hostname,
        dhcpStatus: lease.status,
        dhcpServer: lease.server,
        expiresAfter: lease.expiresAfter,
        lastSeen: lease.lastSeen,
        isNeighborDevice: !!neighbor,
        neighborIdentity: neighbor?.identity || '',
        neighborPlatform: neighbor?.platform || '',
        neighborVersion: neighbor?.version || '',
        discoveredBy: neighbor?.discoveredBy || '',
        dynamic: lease.dynamic,
        complete: false,
        disabled: lease.disabled,
        comment: lease.comment
      });
    });

    return enhancedHosts;
  }

  /**
   * Perform internet speed test
   * Tests latency and download speed
   */
  async performSpeedTest(): Promise<{
    latency: number;
    downloadSpeed: number;
    testServer: string;
    timestamp: string;
  }> {
    if (!this.isConnectionActive()) {
      return this.getMockSpeedTest();
    }

    try {
      const testServer = '1.1.1.1'; // Cloudflare DNS
      const testUrl = 'https://speed.cloudflare.com/__down?bytes=25000000'; // 25MB download test

      // Test latency with ping
      let latency = 0;
      try {
        const pingResult = await this.executeCommand('/ping', {
          address: testServer,
          count: 4
        });

        if (pingResult && pingResult.length > 0) {
          // Calculate average latency from ping results
          const avgTime = pingResult
            .filter((r: any) => r.time)
            .reduce((sum: number, r: any) => {
              const timeStr = r.time.replace('ms', '');
              return sum + parseFloat(timeStr);
            }, 0) / Math.min(4, pingResult.length);

          latency = Math.round(avgTime * 10) / 10;
        }
      } catch (error) {
        console.warn('Ping test failed:', error);
        latency = 0;
      }

      // Test download speed with fetch
      let downloadSpeed = 0;
      try {
        const startTime = Date.now();

        // Use tool/fetch to download test file
        await this.executeCommand('/tool/fetch', {
          url: testUrl,
          mode: 'https',
          'keep-result': 'no'
        });

        const duration = (Date.now() - startTime) / 1000; // seconds
        const fileSizeMB = 25; // 25MB
        downloadSpeed = Math.round((fileSizeMB * 8 / duration) * 100) / 100; // Mbps
      } catch (error) {
        console.warn('Download test failed:', error);
        downloadSpeed = 0;
      }

      return {
        latency,
        downloadSpeed,
        testServer,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Speed test failed:', error);
      return this.getMockSpeedTest();
    }
  }

  /**
   * Mock speed test results for development
   */
  private getMockSpeedTest(): {
    latency: number;
    downloadSpeed: number;
    testServer: string;
    timestamp: string;
  } {
    return {
      latency: 15.5,
      downloadSpeed: 250.75,
      testServer: '1.1.1.1',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Mock DHCP leases for development
   */
  private getMockDhcpLeases(): any[] {
    return [
      {
        id: '*1',
        address: '192.168.88.10',
        macAddress: '00:0C:29:12:34:56',
        hostname: 'desktop-pc',
        status: 'bound',
        expiresAfter: '1h30m',
        lastSeen: '2m30s',
        server: 'dhcp1',
        dynamic: true,
        blocked: false,
        disabled: false,
        comment: 'Main workstation'
      },
      {
        id: '*2',
        address: '192.168.88.11',
        macAddress: '00:0C:29:65:43:21',
        hostname: 'laptop-user1',
        status: 'bound',
        expiresAfter: '45m',
        lastSeen: '5m',
        server: 'dhcp1',
        dynamic: true,
        blocked: false,
        disabled: false,
        comment: ''
      },
      {
        id: '*3',
        address: '192.168.88.15',
        macAddress: 'B8:27:EB:AA:BB:CC',
        hostname: 'raspberry-pi',
        status: 'bound',
        expiresAfter: '2h15m',
        lastSeen: '1m',
        server: 'dhcp1',
        dynamic: true,
        blocked: false,
        disabled: false,
        comment: 'IoT device'
      }
    ];
  }

  /**
   * Mock neighbors for development
   */
  private getMockNeighbors(): any[] {
    return [
      {
        id: '*1',
        interface: 'ether2',
        address: '192.168.88.2',
        address6: '',
        macAddress: 'DC:2C:6E:11:22:33',
        identity: 'Switch-Office',
        platform: 'MikroTik',
        version: '7.11',
        board: 'CRS326',
        uptime: '2w3d5h',
        softwareId: 'ROUTER',
        interfaceName: 'ether1',
        system: 'RouterOS',
        discoveredBy: 'lldp'
      },
      {
        id: '*2',
        interface: 'ether3',
        address: '192.168.88.3',
        address6: '',
        macAddress: 'A4:B1:C2:44:55:66',
        identity: 'AP-Main',
        platform: 'MikroTik',
        version: '7.10.2',
        board: 'cAP',
        uptime: '1w2d',
        softwareId: 'ROUTER',
        interfaceName: 'wlan1',
        system: 'RouterOS',
        discoveredBy: 'lldp,cdp'
      }
    ];
  }
}

// Export singleton accessor
export const mikrotikService = MikroTikService.getInstance();
export default mikrotikService;
