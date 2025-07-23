import type Redis from "ioredis";
import type { Duration } from "pv-duration";
import type {
  ThrottlingRateLimiter,
  ThrottlingResult,
} from "../algorithms/throttling";
import { getKey } from "../utils/key";

declare module "ioredis" {
  interface Redis {
    throttleRequest(
      key: string,
      minInterval: number,
      currentTime: number
    ): Promise<[number, number, number]>; // [success_flag, wait_time, next_allowed_at]
    getThrottleStatus(
      key: string,
      minInterval: number,
      currentTime: number
    ): Promise<[number, number, number]>; // [success_flag, wait_time, next_allowed_at]
  }
}

const PREFIX = "pvrl-throttling";

/**
 * A Redis-backed throttling rate limiter.
 *
 * ## Algorithm Overview
 *
 * This algorithm enforces a minimum delay between requests by tracking the last
 * request timestamp for each key. Unlike counting-based rate limiters, throttling
 * ensures that requests are spaced out evenly over time, preventing burst traffic
 * and providing smooth, controlled access patterns.
 *
 * ## How It Works
 *
 * 1. **Timestamp Tracking**: Each key maintains a timestamp of the last allowed request.
 * 2. **Delay Calculation**: When a new request arrives, the time since the last
 *    request is calculated.
 * 3. **Throttling Decision**: If enough time has passed since the last request
 *    (based on the minimum interval), the request is allowed immediately.
 *    Otherwise, the request is throttled and must wait.
 * 4. **Atomic Updates**: The last request timestamp is updated atomically using
 *    Lua scripts to prevent race conditions in distributed environments.
 *
 * ## Key Benefits
 *
 * - **Smooth Traffic**: Prevents burst traffic by enforcing consistent delays.
 * - **Predictable Behavior**: Each request is guaranteed to have a minimum
 *   interval from the previous one.
 * - **Fair Distribution**: Ensures requests are evenly distributed over time.
 * - **Atomic Operations**: Uses Lua scripts to ensure thread-safe behavior.
 * - **Distributed**: Works across multiple application instances via Redis.
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { ThrottlingRateLimiter } from './throttling';
 *
 * const redis = new Redis('redis://localhost:6379');
 *
 * // Enforce minimum 1 second delay between requests
 * const throttler = new IORedisThrottlingRateLimiter(
 *   redis,
 *   Duration.ofSeconds(1)
 * );
 *
 * const userId = 'user-123';
 *
 * const result = await throttler.throttle(userId);
 *
 * if (result.success) {
 *   console.log('Request allowed immediately');
 * } else {
 *   console.log(`Request throttled. Wait ${result.waitTime}ms`);
 *   console.log(`Next allowed at: ${new Date(result.nextAllowedAt)}`);
 * }
 * ```
 */
export class IORedisThrottlingRateLimiter implements ThrottlingRateLimiter {
  private redis: Redis;
  private name: string;
  /**
   * In milliseconds
   */
  private minInterval: number;

  constructor(redisClient: Redis, name: string, minInterval: Duration) {
    const intervalMs = minInterval.milliseconds;
    if (intervalMs <= 0) {
      throw new Error("Minimum interval must be a positive value.");
    }

    this.redis = redisClient;
    this.name = name;
    this.minInterval = intervalMs;

    this.redis.defineCommand("throttleRequest", {
      numberOfKeys: 1,
      lua: `
        local key = KEYS[1]
        local min_interval = tonumber(ARGV[1])
        local current_time = tonumber(ARGV[2])

        local last_request_time = redis.call('GET', key)
        if not last_request_time then
          last_request_time = 0
        end
        last_request_time = tonumber(last_request_time)

        local time_since_last = current_time - last_request_time
        local wait_time = 0
        local next_allowed_at = current_time

        if time_since_last < min_interval then
          wait_time = min_interval - time_since_last
          next_allowed_at = last_request_time + min_interval
          return {0, wait_time, next_allowed_at}
        else
          redis.call('SET', key, current_time)
          redis.call('EXPIRE', key, math.ceil(min_interval / 1000) + 60)
          return {1, wait_time, next_allowed_at}
        end
      `,
    });

    this.redis.defineCommand("getThrottleStatus", {
      numberOfKeys: 1,
      lua: `
        local key = KEYS[1]
        local min_interval = tonumber(ARGV[1])
        local current_time = tonumber(ARGV[2])

        local last_request_time = redis.call('GET', key)
        if not last_request_time then
          last_request_time = 0
        end
        last_request_time = tonumber(last_request_time)

        local time_since_last = current_time - last_request_time
        local wait_time = 0
        local next_allowed_at = current_time

        if time_since_last < min_interval then
          wait_time = min_interval - time_since_last
          next_allowed_at = last_request_time + min_interval
          return {0, wait_time, next_allowed_at}
        else
          return {1, wait_time, next_allowed_at}
        end
      `,
    });
  }

  private getKey(key: string): string {
    return getKey(PREFIX, this.name, key);
  }

  /**
   * Attempts to process a request, enforcing the minimum delay between requests.
   * @param key A unique identifier for the client (e.g., user ID, IP address).
   * @returns A promise that resolves to an object indicating whether the request
   *          can proceed immediately and how long to wait if throttled.
   */
  public async throttle(key: string): Promise<ThrottlingResult> {
    const redisKey = this.getKey(key);
    const currentTime = Date.now();

    const [success, waitTime, nextAllowedAt] = await this.redis.throttleRequest(
      redisKey,
      this.minInterval,
      currentTime
    );

    return {
      success: success === 1,
      waitTime: waitTime,
      nextAllowedAt: nextAllowedAt,
    };
  }

  /**
   * Gets the current throttling status for a key without updating the timestamp.
   * @param key A unique identifier for the client.
   * @returns A promise that resolves to the throttling result for the current state.
   */
  public async getStatus(key: string): Promise<ThrottlingResult> {
    const redisKey = this.getKey(key);
    const currentTime = Date.now();

    const [success, waitTime, nextAllowedAt] =
      await this.redis.getThrottleStatus(
        redisKey,
        this.minInterval,
        currentTime
      );

    return {
      success: success === 1,
      waitTime: waitTime,
      nextAllowedAt: nextAllowedAt,
    };
  }

  /**
   * Returns the minimum delay between requests in milliseconds.
   */
  public getMinInterval(): number {
    return this.minInterval;
  }

  /**
   * Returns the minimum delay between requests in seconds.
   */
  public getMinIntervalSeconds(): number {
    return Math.ceil(this.minInterval / 1000);
  }
}
