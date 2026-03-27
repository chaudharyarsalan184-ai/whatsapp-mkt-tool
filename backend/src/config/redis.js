import Redis from 'ioredis';
import { REDIS_URL, REDIS_DISABLED } from './env.js';

let connection = null;

export function isRedisEnabled() {
  return !REDIS_DISABLED && connection !== null;
}

export async function initRedis() {
  if (REDIS_DISABLED) {
    console.warn(
      '[redis] Disabled (REDIS_URL=disable). Auth and CRUD work; campaign queue / bulk send need a real Redis URL.'
    );
    return null;
  }

  connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  return connection;
}

export function getRedisConnection() {
  if (REDIS_DISABLED || !connection) {
    throw new Error(
      'Redis is not available. Set REDIS_URL=redis://localhost:6379 (or your Redis) to enable the message queue.'
    );
  }
  return connection;
}
