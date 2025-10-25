/**
 * Rate Limiter for MCP Tool Calls
 *
 * Prevents abuse by limiting the number of tool calls per session
 * within a time window.
 */

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxAttempts: number = 20, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;

    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if session is within rate limit
   */
  check(sessionId: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(sessionId);

    if (!entry) {
      // First attempt for this session
      this.attempts.set(sessionId, { timestamps: [now] });
      return true;
    }

    // Filter out timestamps outside the window
    entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < this.windowMs);

    // Check if under limit
    if (entry.timestamps.length < this.maxAttempts) {
      entry.timestamps.push(now);
      return true;
    }

    return false;
  }

  /**
   * Get remaining attempts for session
   */
  getRemaining(sessionId: string): number {
    const now = Date.now();
    const entry = this.attempts.get(sessionId);

    if (!entry) {
      return this.maxAttempts;
    }

    // Filter out timestamps outside the window
    entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < this.windowMs);

    return Math.max(0, this.maxAttempts - entry.timestamps.length);
  }

  /**
   * Reset rate limit for session
   */
  reset(sessionId: string): void {
    this.attempts.delete(sessionId);
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [sessionId, entry] of this.attempts.entries()) {
      entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < this.windowMs);
      if (entry.timestamps.length === 0) {
        this.attempts.delete(sessionId);
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  dispose(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Global rate limiter instance
export const globalRateLimiter = new RateLimiter(20, 60000); // 20 calls per minute
