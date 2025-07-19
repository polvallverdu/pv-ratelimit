import type Redis from "ioredis";

declare module "ioredis" {
  interface Redis {
    consumeThrottle(key: string, cooldown: number): Promise<[number, number]>;
    getThrottleState(key: string): Promise<number>;
  }
}

export interface ThrottleResult {
  /** Indicates whether the request was successful. */
  success: boolean;
  /** A Unix timestamp (in seconds) indicating when the next request will be allowed. */
  nextAvailableAt: number;
}

const PREFIX = "pv-ratelimit:throttle";

/**
 * A Redis-backed basic throttling mechanism.
 *
 * ## Algorithm Overview
 *
 * Throttling, in this context, ensures that a specific action can only be
 * performed once within a given cooldown period. It's a simple way to prevent
 * rapid, repeated actions.
 *
 * ## How It Works
 *
 * 1. **Check and Set**: The algorithm uses Redis's `SET ... NX EX` command,
 *    which is atomic. It attempts to set a key with a specified expiration (the
 *    cooldown period) only if the key does not already exist.
 * 2. **Success or Failure**: If the key is successfully set, the request is
 *    allowed. If the command fails (because the key already exists), it means
 *    the action is currently in its cooldown period, and the request is denied.
 * 3. **Cooldown**: The key's TTL acts as the cooldown timer. Once it expires,
 *    the action can be performed again.
 *
 * ## Key Benefits
 *
 * - **Simplicity**: Very easy to implement and understand.
 * - **Atomicity**: Relies on a single atomic Redis command, making it safe
 *   for concurrent environments.
 * - **Resource-Efficient**: Requires minimal storage and processing.
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { ThrottlingRateLimiter } from './throttling';
 *
 * const redis = new Redis('redis://localhost:6379');
 *
 * // Allow an action once every 30 seconds
 * const throttler = new ThrottlingRateLimiter(redis, 30);
 *
 * const actionId = 'user-123:send-message';
 *
 * const result = await throttler.consume(actionId);
 *
 * if (result.success) {
 *   console.log('Action allowed.');
 * } else {
 *   console.log(`Action throttled. Try again after ${new Date(result.nextAvailableAt * 1000)}.`);
 * }
 * ```
 */
export class ThrottlingRateLimiter {
  private redis: Redis;
  private cooldown: number;

  constructor(redisClient: Redis, cooldown: number) {
    if (cooldown <= 0) {
      throw new Error("Cooldown must be a positive value.");
    }

    this.redis = redisClient;
    this.cooldown = cooldown;

    this.redis.defineCommand("consumeThrottle", {
      numberOfKeys: 1,
      lua: `
        local key = KEYS[1]
        local cooldown = tonumber(ARGV[1])

        local result = redis.call('SET', key, '1', 'NX', 'EX', cooldown)

        if result then
            -- Successfully set the key, action is allowed
            return {1, 0}
        else
            -- Key exists, action is throttled. Return remaining TTL.
            local ttl = redis.call('PTTL', key)
            return {0, ttl}
        end
      `,
    });

    this.redis.defineCommand("getThrottleState", {
      numberOfKeys: 1,
      lua: `
        return redis.call('PTTL', key)
      `,
    });
  }

  private getKey(key: string): string {
    return `${PREFIX}:${key}`;
  }

  /**
   * Attempts to perform a throttled action.
   * @param key A unique identifier for the action.
   * @returns A promise resolving to the result of the operation.
   */
  public async consume(key: string): Promise<ThrottleResult> {
    const redisKey = this.getKey(key);
    const [success, ttlMs] = await this.redis.consumeThrottle(
      redisKey,
      this.cooldown
    );

    const now = Date.now();
    const nextAvailableAt = success === 1 ? now : now + ttlMs;

    return {
      success: success === 1,
      nextAvailableAt: Math.ceil(nextAvailableAt / 1000),
    };
  }

  /**
   * Checks when the next action will be available.
   * @param key A unique identifier for the action.
   * @returns A promise resolving to a Unix timestamp (in seconds) of availability.
   */
  public async getNextAvailableAt(key: string): Promise<number> {
    const redisKey = this.getKey(key);
    const ttlMs = await this.redis.getThrottleState(redisKey);

    if (ttlMs < 0) {
      // PTTL returns -2 if key does not exist, -1 if it has no expiry.
      // In both cases, it's available now.
      return Math.ceil(Date.now() / 1000);
    }

    return Math.ceil((Date.now() + ttlMs) / 1000);
  }

  public getCooldown(): number {
    return this.cooldown;
  }
}
