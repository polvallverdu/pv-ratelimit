import type { SlidingWindowRateLimiter } from "../algorithms/slidingWindow";
import type { SlidingWindowResult } from "../algorithms/slidingWindow";

/**
 * A dummy sliding window rate limiter that always returns success with -1 remaining tokens.
 * This is useful for testing purposes, or when you want to disable rate limiting.
 */
export class DummySlidingWindow implements SlidingWindowRateLimiter {
  async consume(_key: string): Promise<SlidingWindowResult> {
    return {
      success: true,
      remaining: -1,
    };
  }

  async getRemaining(_key: string): Promise<number> {
    return -1;
  }

  getLimit(): number {
    return -1;
  }

  getInterval(): number {
    return -1;
  }
}
