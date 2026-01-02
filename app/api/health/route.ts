/**
 * Health Check Endpoint
 * GET /api/health - Check service health including Redis/Queue status
 */

import { NextResponse } from 'next/server';
import { isRedisConfigured, pingRedis } from '@/lib/redis';
import { getQueueStats } from '@/lib/scan-queue';
import { isWorkerRunning } from '@/lib/worker';

export async function GET() {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: {
      api: { status: string };
      database: { status: string; message?: string };
      redis: { status: string; configured: boolean; connected?: boolean };
      queue: { status: string; stats?: object; workerRunning?: boolean };
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      api: { status: 'up' },
      database: { status: 'unknown' },
      redis: { status: 'unknown', configured: false },
      queue: { status: 'unknown' },
    },
  };

  // Check database
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = { status: 'up' };
  } catch (error) {
    health.services.database = { 
      status: 'down',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'degraded';
  }

  // Check Redis
  health.services.redis.configured = isRedisConfigured();
  
  if (health.services.redis.configured) {
    try {
      const connected = await pingRedis();
      health.services.redis.status = connected ? 'up' : 'down';
      health.services.redis.connected = connected;
      
      if (!connected) {
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.redis.status = 'down';
      health.services.redis.connected = false;
      health.status = 'degraded';
    }

    // Check queue (only if Redis is up)
    if (health.services.redis.connected) {
      try {
        const stats = await getQueueStats();
        health.services.queue = {
          status: 'up',
          stats,
          workerRunning: isWorkerRunning(),
        };
      } catch (error) {
        health.services.queue = { 
          status: 'degraded',
          workerRunning: false,
        };
      }
    } else {
      health.services.queue = { status: 'unavailable' };
    }
  } else {
    health.services.redis.status = 'not_configured';
    health.services.queue = { status: 'not_configured' };
  }

  // Determine overall status
  const criticalDown = health.services.database.status === 'down';
  if (criticalDown) {
    health.status = 'unhealthy';
  }

  return NextResponse.json(health, {
    status: health.status === 'unhealthy' ? 503 : 200,
  });
}
