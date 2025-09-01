# pv-ratelimit

[![npm version](https://badge.fury.io/js/pv-ratelimit.svg)](https://badge.fury.io/js/pv-ratelimit)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/github/actions/workflow/status/polvallverdu/pv-ratelimit/ci.yml?branch=main)](https://github.com/polvallverdu/pv-ratelimit/actions)

A comprehensive, type-safe TypeScript library providing multiple rate limiting algorithms with both in-memory and Redis-backed implementations.

## ✨ Features

- 🔄 **6 Rate Limiting Algorithms** - Fixed Window, Sliding Window, Sliding Log, Token Bucket, Leaky Bucket, and Throttling
- 🗄️ **Multiple Backends** - Redis and dummy implementations
- 📝 **Type-safe** - Full TypeScript support with strict typing
- ⚡ **High performance** - Optimized Redis Lua scripts for atomic operations and Redis Cluster support
- 🧪 **Well tested** - Comprehensive test coverage for all algorithms
- 🔧 **Flexible** - Easy to switch between algorithms and backends
- 🚀 **Production ready** - Battle-tested, currently being used by [boreal.chat](https://boreal.chat)

## 📦 Installation

```bash
# Using bun
bun add pv-ratelimit

# Using npm
npm install pv-ratelimit

# Using yarn
yarn add pv-ratelimit

# Using pnpm
pnpm add pv-ratelimit
```

### Redis Implementation

For Redis-backed rate limiters, you'll also need `ioredis`:

```bash
# Using bun
bun add ioredis

# Using npm
npm install ioredis
```

## 🚀 Quick Start

### Dummy (Testing/Development)

```typescript
import { DummyFixedWindow, DummyTokenBucket } from "pv-ratelimit/dummy";

const rateLimiter = new DummyFixedWindow();

const tokenLimiter = new DummyTokenBucket();

const result = await rateLimiter.consume("user:123");
console.log(result.success); // true (dummy always succeeds)
```

### Redis-Backed (Production)

```typescript
import Redis from "ioredis";
import {
  IORedisFixedWindowRateLimiter,
  IORedisTokenBucketRateLimiter,
} from "pv-ratelimit/ioredis";
import { Duration } from "pv-duration";

const redis = new Redis();

// Fixed window: 100 requests per hour
const rateLimiter = new IORedisFixedWindowRateLimiter(
  redis,
  100, // limit
  Duration.fromHours(1) // window duration
);

// Token bucket: 50 tokens, refill 10 tokens every 60 seconds
const tokenLimiter = new IORedisTokenBucketRateLimiter(
  redis,
  50, // capacity
  10, // refill amount
  Duration.fromSeconds(60) // refill interval
);

const result = await rateLimiter.consume("user:123");
if (result.success) {
  console.log(`Request allowed. ${result.remaining} requests remaining.`);
} else {
  console.log("Rate limit exceeded!");
}
```

## 🎯 Rate Limiting Algorithms

### 1. Fixed Window

Divides time into fixed-size windows and counts requests per window.

**Best for:** Simple rate limiting with predictable windows.

```typescript
import { IORedisFixedWindowRateLimiter } from "pv-ratelimit/ioredis";
import { Duration } from "pv-duration";

const limiter = new IORedisFixedWindowRateLimiter(
  redis,
  100, // 100 requests
  Duration.fromMinutes(1) // per minute
);

const result = await limiter.consume("api-key:abc123");
```

**Pros:**

- Simple and efficient
- Predictable behavior
- Low memory usage

**Cons:**

- Potential burst at window boundaries
- Less smooth than other algorithms

### 2. Sliding Window

Hybrid approach that smooths out the fixed window using weighted calculations.

**Best for:** Better burst handling while maintaining efficiency.

```typescript
import { IORedisSlidingWindowRateLimiter } from "pv-ratelimit/ioredis";

const limiter = new IORedisSlidingWindowRateLimiter(
  redis,
  100, // 100 requests
  Duration.fromMinutes(1) // per minute
);
```

**Pros:**

- Smoother rate limiting than fixed window
- Good performance
- Reduces boundary burst issues

**Cons:**

- Slightly more complex than fixed window
- Approximation rather than exact counting

### 3. Sliding Log

Maintains a log of all request timestamps for precise rate limiting.

**Best for:** When you need exact rate limiting and can afford higher memory usage.

```typescript
import { IORedisSlidingLogRateLimiter } from "pv-ratelimit/ioredis";

const limiter = new IORedisSlidingLogRateLimiter(
  redis,
  100, // 100 requests
  Duration.fromMinutes(1) // per minute
);
```

**Pros:**

- Most accurate algorithm
- Perfectly smooth rate limiting
- No burst issues

**Cons:**

- Higher memory usage
- More complex cleanup required

### 4. Token Bucket

Allows burst traffic up to bucket capacity while maintaining steady refill rate.

**Best for:** APIs that need to handle legitimate bursts while maintaining long-term rate limits.

```typescript
import { IORedisTokenBucketRateLimiter } from "pv-ratelimit/ioredis";

const limiter = new IORedisTokenBucketRateLimiter(
  redis,
  100, // bucket capacity
  10, // refill 10 tokens
  Duration.fromSeconds(60) // every 60 seconds
);

// Consume multiple tokens at once
const result = await limiter.consume("user:123", 5);
```

**Pros:**

- Excellent for handling bursts
- Flexible token consumption
- Intuitive bucket metaphor

**Cons:**

- Can be complex to configure
- Requires understanding of burst patterns

### 5. Leaky Bucket

Implements a queue-based approach for request buffering.

**Best for:** When you want to smooth out traffic and can buffer requests.

```typescript
import { IORedisLeakyBucketRateLimiter } from "pv-ratelimit/ioredis";

const limiter = new IORedisLeakyBucketRateLimiter(
  redis,
  50, // queue capacity
  "request-123", // unique request ID
  Duration.fromSeconds(30) // processing interval
);
```

**Pros:**

- Smooth traffic processing
- Natural request queuing
- Good for protecting downstream services

**Cons:**

- More complex implementation
- Requires request buffering logic

### 6. Throttling

Enforces a minimum delay between requests by tracking the last request timestamp.

**Best for:** APIs that need to prevent burst traffic and ensure smooth, controlled access patterns.

```typescript
import { IORedisThrottlingRateLimiter } from "pv-ratelimit/ioredis";

const throttler = new IORedisThrottlingRateLimiter(
  redis,
  Duration.fromSeconds(1) // minimum 1 second between requests
);

const result = await throttler.throttle("user:123");
if (result.success) {
  console.log("Request allowed immediately");
} else {
  console.log(`Request throttled. Wait ${result.waitTime}ms`);
  console.log(`Next allowed at: ${new Date(result.nextAllowedAt)}`);
}
```

**Pros:**

- Prevents burst traffic effectively
- Ensures smooth, predictable request distribution
- Simple to understand and implement
- Provides precise timing control

**Cons:**

- May not be suitable for high-frequency legitimate traffic
- Less flexible than counting-based algorithms

## 📚 API Reference

### Common Interfaces

All rate limiters implement algorithm-specific interfaces with these common patterns:

```typescript
interface RateLimitResult {
  success: boolean;      // Whether the request was allowed
  remaining: number;     // Approximate remaining requests/tokens
}

// Algorithm-specific methods
consume(key: string): Promise<RateLimitResult>
getRemaining(key: string): Promise<number>
getLimit(): number
getInterval(): number // Duration in seconds
```

### Fixed Window

```typescript
interface FixedWindowRateLimiter {
  consume(key: string): Promise<FixedWindowResult>;
  getRemaining(key: string): Promise<number>;
  getLimit(): number;
  getInterval(): number;
}
```

### Token Bucket

```typescript
interface TokenBucketRateLimiter {
  consume(key: string, tokens?: number): Promise<ConsumeResult>;
  getRemainingTokens(key: string): Promise<TokenCountResult>;
  addTokens(key: string, amount: number): Promise<void>;
  removeTokens(key: string, amount: number): Promise<void>;
  getCapacity(): number;
  getRefillAmount(): number;
  getRefillInterval(): number;
}
```

### Throttling

```typescript
interface ThrottlingRateLimiter {
  throttle(key: string): Promise<ThrottlingResult>;
  getStatus(key: string): Promise<ThrottlingResult>;
  getMinInterval(): number;
  getMinIntervalSeconds(): number;
}

interface ThrottlingResult {
  success: boolean; // Whether the request was allowed immediately
  waitTime: number; // Milliseconds to wait if throttled
  nextAllowedAt: number; // Timestamp when next request is allowed
}
```

## 🏗️ Implementation Types

### Dummy Implementation

Perfect for testing and development:

```typescript
import {
  DummyFixedWindow,
  DummyTokenBucket,
  DummySlidingWindow,
  DummySlidingLog,
  DummyLeakyBucket,
  DummyThrottling,
} from "pv-ratelimit/dummy";

// Always returns success with -1 remaining
const limiter = new DummyFixedWindow();
```

### Redis Implementation

Production-ready with atomic Lua scripts:

```typescript
import {
  IORedisFixedWindowRateLimiter,
  IORedisTokenBucketRateLimiter,
  IORedisSlidingWindowRateLimiter,
  IORedisSlidingLogRateLimiter,
  IORedisLeakyBucketRateLimiter,
  IORedisThrottlingRateLimiter,
} from "pv-ratelimit/ioredis";
```

## 🧪 Examples

### API Rate Limiting

```typescript
import { Hono } from "hono";
import Redis from "ioredis";
import { IORedisFixedWindowRateLimiter } from "pv-ratelimit/ioredis";
import { Duration } from "pv-duration";

const app = new Hono();
const redis = new Redis();

// 1000 requests per hour per API key
const rateLimiter = new IORedisFixedWindowRateLimiter(
  redis,
  1000,
  Duration.fromHours(1)
);

app.use(async (c, next) => {
  const apiKey = c.req.header("x-api-key");

  if (!apiKey) {
    return c.json({ error: "API key required" }, 401);
  }

  const result = await rateLimiter.consume(apiKey);

  if (!result.success) {
    return c.json(
      {
        error: "Rate limit exceeded",
        remaining: result.remaining,
      },
      429
    );
  }

  c.header("X-RateLimit-Remaining", result.remaining.toString());
  await next();
});

export default app;
```

### User-Specific Rate Limiting

```typescript
import { IORedisTokenBucketRateLimiter } from "pv-ratelimit/ioredis";

// Different limits for different user tiers
const createUserLimiter = (tier: string) => {
  const configs = {
    free: { capacity: 100, refill: 10, interval: Duration.fromMinutes(1) },
    premium: { capacity: 1000, refill: 100, interval: Duration.fromMinutes(1) },
    enterprise: {
      capacity: 10000,
      refill: 1000,
      interval: Duration.fromMinutes(1),
    },
  };

  const config = configs[tier];
  return new IORedisTokenBucketRateLimiter(
    redis,
    config.capacity,
    config.refill,
    config.interval
  );
};

async function handleUserRequest(userId: string, userTier: string) {
  const limiter = createUserLimiter(userTier);
  const result = await limiter.consume(`user:${userId}`);

  return result.success;
}
```

### Multi-Algorithm Rate Limiting

```typescript
// Combine multiple algorithms for comprehensive protection
class MultiLayerRateLimit {
  constructor(
    private burstLimiter: IORedisTokenBucketRateLimiter,
    private sustainedLimiter: IORedisFixedWindowRateLimiter
  ) {}

  async checkLimits(key: string): Promise<boolean> {
    // Check burst protection first
    const burstResult = await this.burstLimiter.consume(key);
    if (!burstResult.success) return false;

    // Check sustained rate limit
    const sustainedResult = await this.sustainedLimiter.consume(key);
    if (!sustainedResult.success) {
      // Return the token since sustained limit was hit
      await this.burstLimiter.addTokens(key, 1);
      return false;
    }

    return true;
  }
}
```

### API Throttling

```typescript
import { Hono } from "hono";
import Redis from "ioredis";
import { IORedisThrottlingRateLimiter } from "pv-ratelimit/ioredis";
import { Duration } from "pv-duration";

const app = new Hono();
const redis = new Redis();

// Enforce minimum 500ms between requests per user
const throttler = new IORedisThrottlingRateLimiter(
  redis,
  Duration.fromMilliseconds(500)
);

app.use(async (c, next) => {
  const userId = c.req.header("x-user-id") || c.req.header("x-forwarded-for");

  if (!userId) {
    return c.json({ error: "User identification required" }, 401);
  }

  const result = await throttler.throttle(userId);

  if (!result.success) {
    return c.json(
      {
        error: "Request throttled",
        waitTime: result.waitTime,
        retryAfter: new Date(result.nextAllowedAt).toISOString(),
      },
      429
    );
  }

  c.header("X-Throttle-Remaining", "0"); // Always 0 for throttling
  c.header("X-Throttle-Reset", new Date(result.nextAllowedAt).toISOString());
  await next();
});

export default app;
```

## 🛠️ Development

### Setup

```bash
# Clone the repository
git clone https://github.com/polvallverdu/pv-ratelimit.git
cd pv-ratelimit

# Install dependencies
bun install
```

### Testing

```bash
# Run tests
bun test

# Run tests with coverage
bun test:coverage

# Run specific test suite
bun test dummy/
bun test ioredis/
```

### Building

```bash
# Build the project
bun run build

# Type checking
bun run typecheck

# Code formatting
bun run check:fix
```

### Testing with Redis

The Redis tests use Testcontainers to automatically spin up Redis instances.

## 🗺️ Roadmap

### 🚧 Upcoming Features

- [ ] **PostgreSQL Implementation** - SQL-based rate limiting for PostgreSQL databases
- [ ] **Upstash Redis Implementation** - Serverless Redis support
- [ ] **Rate Limit Analytics** - Built-in metrics and monitoring

### 🎯 Future Considerations

- [ ] Integration with popular frameworks (Hono, Express, Fastify)
- [ ] Rate limit visualization and debugging tools
- [ ] Performance benchmarking suite

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

If you have any questions or need help, please:

1. Check the [documentation](#-api-reference)
2. Search [existing issues](https://github.com/polvallverdu/pv-ratelimit/issues)
3. Create a [new issue](https://github.com/polvallverdu/pv-ratelimit/issues/new)

## 🔗 Related Projects

- [pv-duration](https://github.com/polvallverdu/pv-duration) - Duration parsing library used by pv-ratelimit

---

<div align="center">
  <strong>⭐ Star this repository if you find it helpful!</strong>
</div>
