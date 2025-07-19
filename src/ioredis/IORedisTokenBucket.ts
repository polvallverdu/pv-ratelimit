import type Redis from "ioredis";
import type { Duration } from "pv-duration";
import type {
	TokenBucketRateLimiter,
	TokenConsumeResult,
	TokenCountResult,
} from "../algorithms/tokenBucket";

declare module "ioredis" {
	interface Redis {
		consumeToken(
			key: string,
			capacity: number,
			refillAmount: number,
			refillInterval: number,
			currentTime: number,
			requestedTokens: number,
		): Promise<[number, number, number]>; // [success_flag, remaining_tokens, next_refill_at]
		getRemainingTokens(
			key: string,
			capacity: number,
			refillAmount: number,
			refillInterval: number,
			currentTime: number,
		): Promise<[number, number]>; // [remaining_tokens, next_refill_at]
	}
}

const PREFIX = "token_bucket";

/**
 * A Redis-backed token bucket rate limiter implementation.
 *
 * ## Algorithm Overview
 *
 * The token bucket algorithm is a rate limiting technique that controls the rate at which
 * requests are processed. It works by maintaining a "bucket" that holds tokens, where:
 * - Tokens are added to the bucket at a fixed rate (refill rate)
 * - Each request consumes one or more tokens from the bucket
 * - If sufficient tokens are available, the request is allowed and tokens are consumed
 * - If insufficient tokens are available, the request is denied/rate limited
 *
 * ## How It Works
 *
 * 1. **Initialization**: The bucket starts with a specified capacity of tokens
 * 2. **Refilling**: Tokens are added to the bucket at regular intervals (refillInterval)
 *    - The bucket never exceeds its maximum capacity
 *    - Refills happen based on elapsed time since the last update
 * 3. **Consumption**: When a request arrives:
 *    - Calculate how many tokens should be added based on elapsed time
 *    - Check if enough tokens are available for the request
 *    - If yes: consume tokens and allow the request
 *    - If no: deny the request without consuming tokens
 *
 * ## Key Benefits
 *
 * - **Burst handling**: Allows short bursts of traffic up to the bucket capacity
 * - **Smooth rate limiting**: Provides consistent long-term rate limiting
 * - **Atomic operations**: Uses Redis Lua scripts for thread-safe operations
 * - **Distributed**: Works across multiple application instances via Redis
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { TokenBucketRateLimiter } from './tokenBucket';
 *
 * const redis = new Redis('redis://localhost:6379');
 *
 * // Create a rate limiter that allows:
 * // - 10 requests maximum (capacity)
 * // - Refills 2 tokens every 1 second
 * // This allows sustained rate of 2 requests/second with bursts up to 10
 * const rateLimiter = new TokenBucketRateLimiter(
 *   redis,
 *   10,  // capacity: maximum tokens in bucket
 *   2,   // refillAmount: tokens added per interval
 *   1    // refillInterval: interval in seconds
 * );
 *
 * // Rate limit by user ID
 * const userId = 'user123';
 *
 * // Try to consume 1 token for a request
 * const result = await rateLimiter.consume(userId, 1);
 *
 * if (result.success) {
 *   console.log(`Request allowed. ${result.remainingTokens} tokens remaining.`);
 *   console.log(`Next refill at: ${new Date(result.nextRefillAt * 1000)}`);
 *   // Process the request...
 * } else {
 *   console.log(`Request denied. ${result.remainingTokens} tokens available.`);
 *   console.log(`Try again after: ${new Date(result.nextRefillAt * 1000)}`);
 *   // Return rate limit error...
 * }
 *
 * // Check remaining tokens without consuming
 * const status = await rateLimiter.getRemainingTokens(userId);
 * console.log(`Current tokens: ${status.remainingTokens}`);
 *
 * // Manually add tokens (e.g., for premium users)
 * await rateLimiter.addTokens(userId, 5);
 *
 * // Remove tokens (e.g., for penalty)
 * await rateLimiter.removeTokens(userId, 2);
 * ```
 */
export class IORedisTokenBucketRateLimiter implements TokenBucketRateLimiter {
	private redis: Redis;
	private capacity: number;
	private refillAmount: number;
	/**
	 * In seconds
	 */
	private refillInterval: number;

	constructor(
		redisClient: Redis,
		capacity: number,
		refillAmount: number,
		refillInterval: Duration,
	) {
		const refillIntervalSeconds = refillInterval.seconds;
		if (capacity <= 0 || refillAmount <= 0 || refillIntervalSeconds <= 0) {
			throw new Error(
				"Capacity, refill amount, and interval must be positive values.",
			);
		}

		this.redis = redisClient;
		this.capacity = capacity;
		this.refillAmount = refillAmount;
		this.refillInterval = refillIntervalSeconds;

		// For dummy clients
		if (redisClient === null) {
			return;
		}

		// Define the Lua script for consumption and register it with ioredis.
		// This script is executed atomically on the Redis server.
		this.redis.defineCommand("consumeToken", {
			numberOfKeys: 1,
			lua: `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_amount = tonumber(ARGV[2])
        local refill_interval = tonumber(ARGV[3])
        local current_time = tonumber(ARGV[4])
        local requested_tokens = tonumber(ARGV[5])

        local bucket = redis.call('HGETALL', key)
        local last_tokens = 0
        local last_updated = current_time 

        if #bucket > 0 then
            for i=1, #bucket, 2 do
                if bucket[i] == 'tokens' then
                    last_tokens = tonumber(bucket[i+1])
                elseif bucket[i] == 'last_updated' then
                    last_updated = tonumber(bucket[i+1])
                end
            end
        else
            last_tokens = capacity
        end

        local elapsed_time = current_time - last_updated
        local current_tokens = last_tokens
        local new_last_updated = last_updated

        if elapsed_time >= refill_interval then
            local refills_to_add = math.floor(elapsed_time / refill_interval)
            local tokens_to_add = refills_to_add * refill_amount
            current_tokens = math.min(capacity, last_tokens + tokens_to_add)
            new_last_updated = last_updated + (refills_to_add * refill_interval)
        end
        
        local next_refill_at = new_last_updated + refill_interval

        if current_tokens >= requested_tokens then
            local remaining_tokens = current_tokens - requested_tokens
            redis.call('HSET', key, 'tokens', remaining_tokens, 'last_updated', new_last_updated)
            -- Return [success_flag, remaining_tokens, next_refill_at]
            return {1, remaining_tokens, next_refill_at}
        else
            -- On failure, return current tokens without consuming any.
            return {0, current_tokens, next_refill_at}
        end
      `,
		});

		// Define the Lua script for getting remaining tokens without consuming any
		this.redis.defineCommand("getRemainingTokens", {
			numberOfKeys: 1,
			lua: `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_amount = tonumber(ARGV[2])
        local refill_interval = tonumber(ARGV[3])
        local current_time = tonumber(ARGV[4])

        local bucket = redis.call('HGETALL', key)
        local last_tokens = 0
        local last_updated = current_time 

        if #bucket > 0 then
            for i=1, #bucket, 2 do
                if bucket[i] == 'tokens' then
                    last_tokens = tonumber(bucket[i+1])
                elseif bucket[i] == 'last_updated' then
                    last_updated = tonumber(bucket[i+1])
                end
            end
        else
            last_tokens = capacity
        end

        local elapsed_time = current_time - last_updated
        local current_tokens = last_tokens
        local new_last_updated = last_updated

        if elapsed_time >= refill_interval then
            local refills_to_add = math.floor(elapsed_time / refill_interval)
            local tokens_to_add = refills_to_add * refill_amount
            current_tokens = math.min(capacity, last_tokens + tokens_to_add)
            new_last_updated = last_updated + (refills_to_add * refill_interval)
        end
        
        local next_refill_at = new_last_updated + refill_interval

        -- Update the bucket state to reflect calculated refills (but don't consume tokens)
        if elapsed_time >= refill_interval then
            redis.call('HSET', key, 'tokens', current_tokens, 'last_updated', new_last_updated)
        end

        -- Return [remaining_tokens, next_refill_at]
        return {current_tokens, next_refill_at}
      `,
		});
	}

	/**
	 * Attempts to consume a specified number of tokens from the bucket.
	 * @param key A unique identifier for the bucket (e.g., user ID, IP address).
	 * @param tokens The number of tokens to consume (defaults to 1).
	 * @returns A promise that resolves to true if tokens were consumed, false otherwise.
	 */
	public async consume(
		key: string,
		tokens: number = 1,
	): Promise<TokenConsumeResult> {
		const redisKey = `${PREFIX}:${key}`;

		const [successFlag, remaining, nextRefill] = await this.redis.consumeToken(
			redisKey,
			this.capacity,
			this.refillAmount,
			this.refillInterval,
			Date.now() / 1000, // Pass current time in seconds
			tokens,
		);

		return {
			success: successFlag === 1,
			remainingTokens: Math.floor(remaining), // Return a whole number
			nextRefillAt: Math.ceil(nextRefill), // Round up to be safe
		};
	}

	/**
	 * Gets the current number of tokens in the bucket without consuming any.
	 * @param key A unique identifier for the bucket (e.g., user ID, IP address).
	 * @returns A promise that resolves to the current token count and next refill time.
	 */
	public async getRemainingTokens(key: string): Promise<TokenCountResult> {
		const redisKey = `${PREFIX}:${key}`;

		const [remaining, nextRefill] = await this.redis.getRemainingTokens(
			redisKey,
			this.capacity,
			this.refillAmount,
			this.refillInterval,
			Date.now() / 1000, // Pass current time in seconds
		);

		return {
			remainingTokens: Math.floor(remaining), // Return a whole number
			nextRefillAt: Math.ceil(nextRefill), // Round up to be safe
		};
	}

	public async addTokens(key: string, amount: number): Promise<void> {
		if (amount <= 0) return;
		const redisKey = `${PREFIX}:${key}`;
		const addScript = `
        local key = KEYS[1]
        local amount = tonumber(ARGV[1])
        local capacity = tonumber(ARGV[2])
        local current_time = tonumber(ARGV[3])

        local bucket = redis.call('HGETALL', key)
        local current_tokens = capacity

        if #bucket > 0 then
            for i=1, #bucket, 2 do
                if bucket[i] == 'tokens' then
                    current_tokens = tonumber(bucket[i+1])
                    break
                end
            end
        else
            -- Initialize bucket with full capacity and current time
            redis.call('HSET', key, 'tokens', capacity, 'last_updated', current_time)
        end

        local new_tokens = math.min(capacity, current_tokens + amount)
        redis.call('HSET', key, 'tokens', new_tokens)
        return 0
    `;
		await this.redis.eval(
			addScript,
			1,
			redisKey,
			amount,
			this.capacity,
			Date.now() / 1000,
		);
	}

	public async removeTokens(key: string, amount: number): Promise<void> {
		if (amount <= 0) return;
		const redisKey = `${PREFIX}:${key}`;
		const removeScript = `
        local key = KEYS[1]
        local amount = tonumber(ARGV[1])
        local capacity = tonumber(ARGV[2])
        local current_time = tonumber(ARGV[3])

        local bucket = redis.call('HGETALL', key)
        local current_tokens = capacity

        if #bucket > 0 then
            for i=1, #bucket, 2 do
                if bucket[i] == 'tokens' then
                    current_tokens = tonumber(bucket[i+1])
                    break
                end
            end
        else
            -- Initialize bucket with full capacity and current time
            redis.call('HSET', key, 'tokens', capacity, 'last_updated', current_time)
        end

        local new_tokens = math.max(0, current_tokens - amount)
        redis.call('HSET', key, 'tokens', new_tokens)
        return 0
    `;
		await this.redis.eval(
			removeScript,
			1,
			redisKey,
			amount,
			this.capacity,
			Date.now() / 1000,
		);
	}

	public getCapacity(): number {
		return this.capacity;
	}

	public getRefillAmount(): number {
		return this.refillAmount;
	}

	public getRefillInterval(): number {
		return this.refillInterval;
	}
}
