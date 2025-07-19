import type { StartedRedisContainer } from "@testcontainers/redis";
import { RedisContainer } from "@testcontainers/redis";
import { afterAll, beforeAll } from "vitest";

export function useRedisContainer() {
  let redisContainer: StartedRedisContainer | undefined;

  beforeAll(async () => {
    redisContainer = await new RedisContainer("redis:latest").start();
  });

  afterAll(async () => {
    await redisContainer?.stop();
  });

  return () => redisContainer;
}
