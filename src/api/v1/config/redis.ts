// redisConnection.js
import Redis from 'ioredis';

let redisClient: Redis | null = null;
const redisCredential = {
   host: process.env.REDIS_LABS_HOST,
   port: parseInt(process.env.REDIS_LABS_PORT, 10),
   username: process.env.REDIS_LABS_USERNAME,
   password: process.env.REDIS_LABS_PASSWORD,
   maxRetriesPerRequest: null,
};
export function initializeRedisConnection(): Redis {
   if (redisClient && redisClient.status === 'ready') {
      return redisClient;
   }
   // const upstashRedisUrl =
   //    'rediss://default:AVDaAAIjcDE4MjEwOGVjMWU1YWI0NDA5OTc5ZTAyODJiYjNkZWM4NXAxMA@alert-bream-20698.upstash.io:6379';

   // redisClient = new Redis(upstashRedisUrl, {
   //    tls: {
   //       rejectUnauthorized: false,
   //    },
   //    maxRetriesPerRequest: null,
   //    retryStrategy: (times) => {
   //       const delay = Math.min(times * 100, 5000);
   //       return delay;
   //    },
   // });

   redisClient = new Redis(redisCredential);
   redisClient.on('connect', () => {
      console.log('Connected to Redis');
   });

   redisClient.on('ready', () => {
      console.log('Redis connection ready');
   });

   redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
   });

   redisClient.on('close', () => {
      console.log('Redis connection closed');
   });

   redisClient.on('reconnecting', () => {
      console.log('Reconnecting to Redis...');
   });

   redisClient.on('end', () => {
      console.log('Redis connection ended');
      redisClient = null;
   });

   return redisClient;
}

export function getRedisConnection(): Redis {
   if (!redisClient || redisClient.status !== 'ready') {
      return initializeRedisConnection();
   }
   return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
   if (redisClient) {
      console.log('Closing Redis connection');
      try {
         await redisClient.quit();
      } catch (err) {
         console.error('Error while closing Redis connection:', err);
      } finally {
         redisClient = null;
      }
   }
}

export async function clearRedisCache(): Promise<void> {
   const client = getRedisConnection();
   try {
      await client.flushall();
      await client.disconnect();

      console.log('Redis cache cleared successfully');
   } catch (err) {
      console.error('Error clearing Redis cache:', err);
   }
}

// clearRedisCache();
