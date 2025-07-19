declare module "ioredis" {
  interface Redis {
    consumeLeakyBucket(
      key: string,
      capacity: number,
      requestId: string,
      interval: number
    ): Promise<[number, number]>;
    getStateLeakyBucket(
      key: string,
      capacity: number
    ): Promise<[number, number]>;
  }
}

export interface LeakyBucketResult {
  /** Indicates whether the request was successful (the bucket has capacity). */
  success: boolean;
  /** The remaining capacity in the bucket's queue. */
  remaining: number;
}

export interface LeakyBucketState {
  /** The current number of requests in the queue. */
  size: number;
  /** The remaining capacity in the queue. */
  remaining: number;
}

/**
 * Interface for a leaky bucket rate limiter, implemented as a capped queue.
 *
 * ## Algorithm Overview
 *
 * This implementation models a simple queue with a fixed capacity. Requests are
 * added to the queue if there is space. If the queue is full, new requests are
 * rejected. This approach does not include a "leak" mechanism to process
 * requests at a steady rate but serves as a basic overflow protection.
 *
 * ## How It Works
 *
 * 1. **Queue Check**: On a new request, the current length of the queue
 *    is checked.
 * 2. **Enqueue or Reject**: If the queue size is less than its capacity, the new
 *    request is added. Otherwise, it is rejected.
 * 3. **Atomicity**: Ensures that checking the queue size and adding
 *    a new request are performed as a single, atomic operation.
 */
export interface LeakyBucketRateLimiter {
  /**
   * Attempts to add a request to the bucket's queue.
   * @param key A unique identifier for the client.
   * @param uniqueRequestId An optional unique ID for the request.
   * @returns A promise resolving to the result of the operation.
   */
  consume(key: string, uniqueRequestId?: string): Promise<LeakyBucketResult>;

  /**
   * Retrieves the current state of the bucket (queue size and remaining capacity).
   * @param key A unique identifier for the client.
   * @returns A promise resolving to the bucket's state.
   */
  getState(key: string): Promise<LeakyBucketState>;

  /**
   * Returns the capacity of the bucket.
   */
  getCapacity(): number;
}
