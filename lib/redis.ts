/**
 * Redis client configuration for Upstash
 * Used by Bull queue for scan job processing
 */

import Redis from 'ioredis';

// Singleton Redis instance
let redisInstance: Redis | null = null;

/**
 * Get Redis client instance
 * Uses Upstash Redis URL from environment
 */
export function getRedis(): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  const redisUrl = process.env.UPSTASH_REDIS_URL;
  
  if (!redisUrl) {
    throw new Error(
      'Redis is not configured. Set UPSTASH_REDIS_URL environment variable.\n' +
      'Get your URL from https://console.upstash.com'
    );
  }

  // Upstash Redis connection with TLS
  redisInstance = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('[Redis] Max retries reached, giving up');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      console.log(`[Redis] Retrying connection in ${delay}ms...`);
      return delay;
    },
    // Upstash requires TLS
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  });

  redisInstance.on('connect', () => {
    console.log('[Redis] Connected to Upstash');
  });

  redisInstance.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  redisInstance.on('close', () => {
    console.log('[Redis] Connection closed');
  });

  return redisInstance;
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!process.env.UPSTASH_REDIS_URL;
}

/**
 * Get Redis connection options for Bull queue
 * Bull needs separate options format
 */
export function getBullRedisOptions() {
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  
  if (!redisUrl) {
    throw new Error('UPSTASH_REDIS_URL not configured');
  }

  // Parse the Redis URL
  const url = new URL(redisUrl);
  
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    maxRetriesPerRequest: 3,
  };
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    console.log('[Redis] Connection closed gracefully');
  }
}

/**
 * Simple health check for Redis
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('[Redis] Ping failed:', error);
    return false;
  }
}
