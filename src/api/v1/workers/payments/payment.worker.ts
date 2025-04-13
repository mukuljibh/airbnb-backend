import { getRedisConnection } from '../../config/redis';
import { Worker } from 'bullmq';
import { paymentProcessor } from './payment.processor';
export const StripeWorker = new Worker('payment-processing', paymentProcessor, {
   connection: getRedisConnection(),
   concurrency: 2,
   stalledInterval: 5000,
   drainDelay: 5000,
});

// Worker event handlers with log statements
StripeWorker.on('active', (job) => {
   console.log(`Job ${job.id} is now active`);
});

StripeWorker.on('stalled', (jobId) => {
   console.debug(`Job ${jobId} has stalled`);
});

StripeWorker.on('completed', (job) => {
   console.debug(`Job ${job.id} has been completed`);
});

StripeWorker.on('failed', (job, err) => {
   console.debug(`Job ${job.id} failed with error:`, err);
});

StripeWorker.on('error', (err) => {
   console.error('Worker error:', err);
});

console.log('Worker is running...');
