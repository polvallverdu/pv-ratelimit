import type { SlidingLogRateLimiter } from "../algorithms/slidingLog";
import type { SlidingLogResult } from "../algorithms/slidingLog";

/**
 * A dummy sliding log rate limiter that always returns success with -1 remaining tokens.
 * This is useful for testing purposes, or when you want to disable rate limiting.
 */
export class DummySlidingLog implements SlidingLogRateLimiter {
  async consume(
    _key: string,
    _uniqueRequestId?: string
  ): Promise<SlidingLogResult> {
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
