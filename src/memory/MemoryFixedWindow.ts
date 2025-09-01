import type { Duration } from "pv-duration";
import type {
  FixedWindowRateLimiter,
  FixedWindowResult,
} from "../algorithms/fixedWindow";

interface WindowData {
  /** Current count of requests in this window */
  count: number;
  /** Start timestamp of this window (in seconds) */
  windowStart: number;
}

/**
 * In-memory implementation of the Fixed Window Rate Limiter.
 *
 * This implementation uses a Map to store window data for each key.
 * Each window is identified by a start timestamp, and requests within
 * the same window increment the same counter.
 *
 * ## Memory Management
 * - Windows are automatically cleaned up when they expire
 * - The Map grows with the number of unique keys, not with time
 * - Each key stores only the current window data
 */
export class MemoryFixedWindow implements FixedWindowRateLimiter {
  private readonly storage = new Map<string, WindowData>();
  private readonly limit: number;
  /**
   * In seconds
   */
  private readonly interval: number;

  /**
   * Creates a new Memory Fixed Window Rate Limiter.
   * @param limit Maximum number of requests allowed per window
   * @param interval Duration of each window
   */
  constructor(limit: number, interval: Duration) {
    if (limit <= 0) {
      throw new Error("Limit must be greater than 0");
    }
    if (interval.seconds <= 0) {
      throw new Error("Interval must be greater than 0");
    }

    this.limit = limit;
    this.interval = interval.seconds;
  }

  /**
   * Attempts to consume a token for a given key.
   * @param key A unique identifier for the client (e.g., user ID, IP address).
   * @returns A promise that resolves to an object indicating success and remaining tokens.
   */
  async consume(key: string): Promise<FixedWindowResult> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = this.getWindowStart(now);

    // Get or create window data for this key
    let windowData = this.storage.get(key);

    // If no data exists or we're in a new window, create fresh data
    if (!windowData || windowData.windowStart !== windowStart) {
      windowData = {
        count: 0,
        windowStart: windowStart,
      };
    }

    // Check if we can consume a token
    if (windowData.count >= this.limit) {
      return {
        success: false,
        remaining: 0,
      };
    }

    // Increment the counter and update storage
    windowData.count++;
    this.storage.set(key, windowData);

    return {
      success: true,
      remaining: this.limit - windowData.count,
    };
  }

  /**
   * Retrieves the number of remaining requests for a given key in the current window.
   * @param key A unique identifier for the client.
   * @returns A promise that resolves to the number of remaining requests.
   */
  async getRemaining(key: string): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = this.getWindowStart(now);

    const windowData = this.storage.get(key);

    // If no data exists or we're in a new window, all tokens are available
    if (!windowData || windowData.windowStart !== windowStart) {
      return this.limit;
    }

    return Math.max(0, this.limit - windowData.count);
  }

  /**
   * Returns the maximum number of requests allowed in a window.
   */
  getLimit(): number {
    return this.limit;
  }

  /**
   * Returns the duration of the window in seconds.
   */
  getInterval(): number {
    return this.interval;
  }

  /**
   * Calculates the start timestamp of the window containing the given timestamp.
   * @param timestamp Unix timestamp in seconds
   * @returns Window start timestamp in seconds
   */
  private getWindowStart(timestamp: number): number {
    return Math.floor(timestamp / this.interval) * this.interval;
  }

  /**
   * Cleans up expired windows for a specific key.
   * This is called automatically during consume operations.
   * @param key The key to clean up
   */
  private cleanupExpired(key: string): void {
    const now = Math.floor(Date.now() / 1000);
    const currentWindowStart = this.getWindowStart(now);

    const windowData = this.storage.get(key);
    if (windowData && windowData.windowStart < currentWindowStart) {
      this.storage.delete(key);
    }
  }

  /**
   * Cleans up all expired windows across all keys.
   * This can be called periodically to free memory.
   */
  cleanupAllExpired(): void {
    const now = Math.floor(Date.now() / 1000);
    const currentWindowStart = this.getWindowStart(now);

    for (const [key, windowData] of this.storage.entries()) {
      if (windowData.windowStart < currentWindowStart) {
        this.storage.delete(key);
      }
    }
  }

  /**
   * Gets the current number of active keys in storage.
   * Useful for monitoring memory usage.
   */
  getActiveKeyCount(): number {
    return this.storage.size;
  }

  /**
   * Clears all stored data.
   * Useful for testing or resetting the rate limiter.
   */
  clear(): void {
    this.storage.clear();
  }
}
