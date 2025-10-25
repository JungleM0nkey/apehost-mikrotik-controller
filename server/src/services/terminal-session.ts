import mikrotikService from './mikrotik.js';

export interface TerminalSession {
  id: string;
  socketId: string;
  createdAt: Date;
  lastActivity: Date;
  commandHistory: string[];
}

class TerminalSessionManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private readonly MAX_HISTORY = 100;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Create a new terminal session
   */
  createSession(socketId: string): TerminalSession {
    const session: TerminalSession = {
      id: this.generateSessionId(),
      socketId,
      createdAt: new Date(),
      lastActivity: new Date(),
      commandHistory: [],
    };

    this.sessions.set(session.id, session);
    console.log(`[Terminal] Session created: ${session.id} (socket: ${socketId})`);
    
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session by socket ID
   */
  getSessionBySocketId(socketId: string): TerminalSession | undefined {
    return Array.from(this.sessions.values()).find(s => s.socketId === socketId);
  }

  /**
   * Update session activity
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Add command to history
   */
  addToHistory(sessionId: string, command: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.commandHistory.push(command);
      
      // Limit history size
      if (session.commandHistory.length > this.MAX_HISTORY) {
        session.commandHistory.shift();
      }
    }
  }

  /**
   * Get command history for session
   */
  getHistory(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session ? [...session.commandHistory] : [];
  }

  /**
   * Execute command in session
   */
  async executeCommand(sessionId: string, command: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    this.updateActivity(sessionId);
    this.addToHistory(sessionId, command);

    try {
      const output = await mikrotikService.executeTerminalCommand(command);
      return output;
    } catch (error: any) {
      throw new Error(error.message || 'Command execution failed');
    }
  }

  /**
   * Remove session
   */
  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`[Terminal] Session removed: ${sessionId}`);
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Remove session by socket ID
   */
  removeSessionBySocketId(socketId: string): void {
    const session = this.getSessionBySocketId(socketId);
    if (session) {
      this.removeSession(session.id);
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Terminal] Cleaned up ${cleaned} expired sessions`);
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const terminalSessionManager = new TerminalSessionManager();
export default terminalSessionManager;
