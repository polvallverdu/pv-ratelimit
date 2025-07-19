import type { LeakyBucketRateLimiter } from "../algorithms/leakyBucket";
import type {
  LeakyBucketResult,
  LeakyBucketState,
} from "../algorithms/leakyBucket";

/**
 * A dummy leaky bucket rate limiter that always returns success with -1 remaining capacity.
 * This is useful for testing purposes, or when you want to disable rate limiting.
 */
export class DummyLeakyBucket implements LeakyBucketRateLimiter {
  async consume(
    _key: string,
    _uniqueRequestId?: string
  ): Promise<LeakyBucketResult> {
    return {
      success: true,
      remaining: -1,
    };
  }

  async getState(_key: string): Promise<LeakyBucketState> {
    return {
      size: -1,
      remaining: -1,
    };
  }

  getCapacity(): number {
    return -1;
  }
}
