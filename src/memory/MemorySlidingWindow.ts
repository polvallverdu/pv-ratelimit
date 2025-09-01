import type { Duration } from "pv-duration";
import type {
  SlidingWindowRateLimiter,
  SlidingWindowResult,
} from "../algorithms/slidingWindow";

interface WindowData {
  /** Current window counter */
  current: number;
  /** Previous window counter */
  previous: number;
  /** Start timestamp of the current window */
  currentWindowStart: number;
}

/**
 * In-memory implementation of the sliding window rate limiter.
 *
 * This algorithm provides a hybrid approach between fixed window and sliding log
 * by using a weighted calculation that considers both the current window and
 * a portion of the previous window's count. This smooths out burst traffic
 * that can occur at window boundaries.
 */
export class MemorySlidingWindow implements SlidingWindowRateLimiter {
  private readonly limit: number;
  /**
   * In seconds
   */
  private readonly interval: number;
  private readonly windows: Map<string, WindowData> = new Map();

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

  async consume(key: string): Promise<SlidingWindowResult> {
    const now = Math.floor(Date.now() / 1000);
    const currentWindowStart = Math.floor(now / this.interval) * this.interval;

    // Get or initialize window data
    let windowData = this.windows.get(key);
    if (!windowData) {
      windowData = {
        current: 0,
        previous: 0,
        currentWindowStart,
      };
      this.windows.set(key, windowData);
    }

    // Check if we need to transition to a new window
    if (windowData.currentWindowStart !== currentWindowStart) {
      // Move current to previous, reset current
      windowData.previous = windowData.current;
      windowData.current = 0;
      windowData.currentWindowStart = currentWindowStart;
    }

    // Calculate the weighted rate
    const weightedRate = this.calculateWeightedRate(windowData, now);

    // Check if the request is allowed
    if (weightedRate >= this.limit) {
      return {
        success: false,
        remaining: Math.max(0, this.limit - weightedRate),
      };
    }

    // Increment the current window counter
    windowData.current++;

    return {
      success: true,
      remaining: Math.max(0, this.limit - (weightedRate + 1)),
    };
  }

  async getRemaining(key: string): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const windowData = this.windows.get(key);

    if (!windowData) {
      return this.limit;
    }

    // Update window data if needed (without consuming)
    const currentWindowStart = Math.floor(now / this.interval) * this.interval;
    if (windowData.currentWindowStart !== currentWindowStart) {
      windowData.previous = windowData.current;
      windowData.current = 0;
      windowData.currentWindowStart = currentWindowStart;
    }

    const weightedRate = this.calculateWeightedRate(windowData, now);
    return Math.max(0, this.limit - weightedRate);
  }

  getLimit(): number {
    return this.limit;
  }

  getInterval(): number {
    return this.interval;
  }

  /**
   * Calculates the weighted rate by considering the current window count
   * plus a weighted portion of the previous window count.
   */
  private calculateWeightedRate(windowData: WindowData, now: number): number {
    const currentWindowEnd = windowData.currentWindowStart + this.interval;
    const overlap = currentWindowEnd - now;

    // If we're in the current window, calculate the weight of the previous window
    // that still falls within our sliding interval
    const weight = Math.max(0, overlap / this.interval);

    return windowData.current + Math.floor(windowData.previous * weight);
  }

  /**
   * Cleans up expired window data to prevent memory leaks.
   * This should be called periodically in production environments.
   */
  cleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    const cutoffTime = now - this.interval * 2; // Keep data for 2 intervals

    for (const [key, windowData] of this.windows.entries()) {
      const windowEnd = windowData.currentWindowStart + this.interval;
      if (windowEnd < cutoffTime) {
        this.windows.delete(key);
      }
    }
  }

  /**
   * Gets the current state of a window for debugging purposes.
   */
  getWindowState(key: string): WindowData | undefined {
    return this.windows.get(key);
  }

  /**
   * Returns the total number of tracked windows (for monitoring).
   */
  getWindowCount(): number {
    return this.windows.size;
  }
}
