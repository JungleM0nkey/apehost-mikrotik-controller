import { io, Socket } from 'socket.io-client';

export interface TerminalOutputEvent {
  command: string;
  output: string;
  executionTime: number;
  timestamp: string;
}

export interface TerminalErrorEvent {
  command: string;
  error: string;
  timestamp: string;
}

export interface TerminalExecutingEvent {
  command: string;
  timestamp: string;
}

export interface SessionCreatedEvent {
  sessionId: string;
  timestamp: string;
}

export interface TerminalHistoryEvent {
  history: string[];
  timestamp: string;
}

export interface InterfacesUpdateEvent {
  interfaces: NetworkInterface[];
  timestamp: string;
}

export interface InterfacesErrorEvent {
  error: string;
  timestamp: string;
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

type EventCallback<T> = (data: T) => void;

export class WebSocketService {
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private sessionReadyPromise: Promise<void> | null = null;
  private sessionReadyResolve: (() => void) | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    if (this.socket?.connected && this.sessionId) {
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (this.socket?.connected && this.sessionId) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
      });
    }

    this.isConnecting = true;

    // Create a promise that resolves when session is created
    this.sessionReadyPromise = new Promise((resolve) => {
      this.sessionReadyResolve = resolve;
    });

    return new Promise((resolve, reject) => {
      try {
        const serverUrl = import.meta.env.DEV
          ? 'http://localhost:3000'
          : window.location.origin;

        this.socket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
        });

        this.socket.on('connect', () => {
          console.log('[WebSocket] Connected to server');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          // Clear session ID on new connection - wait for new session:created event
          this.sessionId = null;
          this.sessionReadyPromise = new Promise((resolve) => {
            this.sessionReadyResolve = resolve;
          });
          resolve();
        });

        this.socket.on('session:created', (data: SessionCreatedEvent) => {
          console.log('[WebSocket] Session created:', data.sessionId);
          this.sessionId = data.sessionId;
          // Resolve the session ready promise
          if (this.sessionReadyResolve) {
            this.sessionReadyResolve();
            this.sessionReadyResolve = null;
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('[WebSocket] Connection error:', error.message);
          this.isConnecting = false;
          this.reconnectAttempts++;

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error('Max reconnection attempts reached'));
          }
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[WebSocket] Disconnected:', reason);
          // Clear session ID on disconnect
          this.sessionId = null;

          // Attempt automatic reconnection for certain disconnect reasons
          if (reason === 'io server disconnect') {
            // Server disconnected, try to reconnect after a delay
            console.log('[WebSocket] Server initiated disconnect, attempting reconnect...');
            setTimeout(() => {
              if (!this.socket?.connected) {
                this.socket?.connect();
              }
            }, 1000);
          }
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   * Note: Only disconnects the socket, doesn't null the instance
   * This allows reconnection without reinitializing
   */
  disconnect(): void {
    if (this.socket?.connected) {
      this.socket.disconnect();
      console.log('[WebSocket] Disconnected from server');
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get the underlying socket instance
   * Use with caution - prefer using dedicated methods when available
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Execute terminal command
   * Waits for connection and session creation before executing
   */
  async executeCommand(command: string): Promise<void> {
    // If socket doesn't exist, throw error
    if (!this.socket) {
      throw new Error('WebSocket not initialized. Please refresh the page.');
    }

    // Wait for session to be ready (both connected and session created)
    if (!this.socket.connected || !this.sessionId) {
      console.log('[WebSocket] Waiting for session to be ready...');

      // Wait for connection if not connected
      if (!this.socket.connected) {
        if (this.isConnecting) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Connection timeout'));
            }, 5000);

            const checkConnection = setInterval(() => {
              if (this.socket?.connected) {
                clearInterval(checkConnection);
                clearTimeout(timeout);
                resolve();
              }
            }, 100);
          });
        } else {
          throw new Error('WebSocket not connected. Attempting to reconnect...');
        }
      }

      // Wait for session to be created
      if (!this.sessionId && this.sessionReadyPromise) {
        console.log('[WebSocket] Waiting for session creation...');
        try {
          await Promise.race([
            this.sessionReadyPromise,
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Session creation timeout')), 5000)
            )
          ]);
          console.log('[WebSocket] Session ready, executing command');
        } catch (error) {
          throw new Error('Failed to create session. Please try again.');
        }
      }
    }

    // Execute command with session ID
    this.socket.emit('terminal:execute', {
      command,
      sessionId: this.sessionId,
    });
  }

  /**
   * Get command history
   */
  getHistory(): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('terminal:getHistory', {
      sessionId: this.sessionId,
    });
  }

  /**
   * Send ping to check connection
   */
  ping(): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('ping');
  }

  /**
   * Listen for terminal output
   */
  onOutput(callback: EventCallback<TerminalOutputEvent>): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    this.socket.on('terminal:output', callback);
    
    // Return cleanup function
    return () => {
      this.socket?.off('terminal:output', callback);
    };
  }

  /**
   * Listen for terminal errors
   */
  onError(callback: EventCallback<TerminalErrorEvent>): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    this.socket.on('terminal:error', callback);
    
    return () => {
      this.socket?.off('terminal:error', callback);
    };
  }

  /**
   * Listen for command execution start
   */
  onExecuting(callback: EventCallback<TerminalExecutingEvent>): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    this.socket.on('terminal:executing', callback);
    
    return () => {
      this.socket?.off('terminal:executing', callback);
    };
  }

  /**
   * Listen for command history
   */
  onHistory(callback: EventCallback<TerminalHistoryEvent>): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    this.socket.on('terminal:history', callback);
    
    return () => {
      this.socket?.off('terminal:history', callback);
    };
  }

  /**
   * Listen for connection events
   */
  onConnect(callback: () => void): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    this.socket.on('connect', callback);
    
    return () => {
      this.socket?.off('connect', callback);
    };
  }

  /**
   * Listen for disconnection events
   */
  onDisconnect(callback: (reason: string) => void): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    this.socket.on('disconnect', callback);
    
    return () => {
      this.socket?.off('disconnect', callback);
    };
  }

  /**
   * Listen for pong response
   */
  onPong(callback: (data: { timestamp: number }) => void): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    this.socket.on('pong', callback);

    return () => {
      this.socket?.off('pong', callback);
    };
  }

  /**
   * Subscribe to interface statistics updates
   */
  subscribeToInterfaces(interval: number = 1000): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('interfaces:subscribe', { interval });
  }

  /**
   * Unsubscribe from interface statistics updates
   */
  unsubscribeFromInterfaces(): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('interfaces:unsubscribe');
  }

  /**
   * Listen for interface updates
   */
  onInterfacesUpdate(callback: EventCallback<InterfacesUpdateEvent>): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    this.socket.on('interfaces:update', callback);

    return () => {
      this.socket?.off('interfaces:update', callback);
    };
  }

  /**
   * Listen for interface errors
   */
  onInterfacesError(callback: EventCallback<InterfacesErrorEvent>): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    this.socket.on('interfaces:error', callback);

    return () => {
      this.socket?.off('interfaces:error', callback);
    };
  }

  /**
   * Generic event subscription method for custom events
   * @param event - Event name to subscribe to
   * @param callback - Callback function to execute when event is received
   * @returns Cleanup function to unsubscribe
   */
  on<T = any>(event: string, callback: (data: T) => void): () => void {
    if (!this.socket) return () => {};

    this.socket.on(event, callback);
    return () => this.socket?.off(event, callback);
  }

  /**
   * Generic event unsubscription method for custom events
   * @param event - Event name to unsubscribe from
   * @param callback - Callback function to remove
   */
  off<T = any>(event: string, callback: (data: T) => void): void {
    if (!this.socket) return;

    this.socket.off(event, callback);
  }
}

/**
 * Create a new WebSocket service instance
 * Use this for multiple independent terminal connections
 */
export function createWebSocketService(): WebSocketService {
  return new WebSocketService();
}

// Export singleton instance for backward compatibility
export const websocket = new WebSocketService();
export default websocket;
