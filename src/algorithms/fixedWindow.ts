export interface FixedWindowResult {
  /** Indicates whether the request was successful. */
  success: boolean;
  /** The number of requests remaining in the current window. */
  remaining: number;
}

/**
 * Interface for a fixed window rate limiter.
 *
 * ## Algorithm Overview
 *
 * This algorithm divides time into fixed-size windows (e.g., one minute) and
 * assigns a counter to each window. Each request increments the counter for the
 * current window. If the counter exceeds the limit, further requests in that
 * window are rejected.
 *
 * ## How It Works
 *
 * 1. **Window Identification**: The current time is used to determine the
 *    active window. For example, if the interval is 60 seconds, all timestamps
 *    within the same minute belong to the same window.
 * 2. **Counting**: A key is created using the user identifier and the
 *    current window timestamp.
 * 3. **Increment and Check**: On each request, the counter for the current window
 *    is atomically incremented. If the new count is above the limit, the request
 *    is denied.
 * 4. **Window Expiry**: Keys are automatically expired after the window duration
 *    to clean up old data.
 *
 * ## Key Benefits
 *
 * - **Simplicity**: Easy to implement and understand.
 * - **Atomicity**: Ensures that checking and incrementing the
 *   limit are performed as a single, atomic operation.
 */
export interface FixedWindowRateLimiter {
  /**
   * Attempts to consume a token for a given key.
   * @param key A unique identifier for the client (e.g., user ID, IP address).
   * @returns A promise that resolves to an object indicating success and remaining tokens.
   */
  consume(key: string): Promise<FixedWindowResult>;

  /**
   * Retrieves the number of remaining requests for a given key in the current window.
   * @param key A unique identifier for the client.
   * @returns A promise that resolves to the number of remaining requests.
   */
  getRemaining(key: string): Promise<number>;

  /**
   * Returns the maximum number of requests allowed in a window.
   */
  getLimit(): number;

  /**
   * Returns the duration of the window in seconds.
   */
  getInterval(): number;
}
