// import { closeRedisConnection } from '../config/redis';
// import { paymentQueue } from './payments/payment.queue';
// import { StripeWorker } from './payments/payment.worker';
// export async function closeWorkers() {
//    try {
//       await Promise.all([StripeWorker.close(), paymentQueue.close()]);
//       console.log('Workers closed successfully');
//       // const jobs = await paymentQueue.getJobs(['waiting', 'active', 'delayed']);
//       // console.log('Queued Jobs:', jobs);
//    } catch (err) {
//       console.log('error during closing worker', err);
//       throw err;
//    } finally {
//       closeRedisConnection();
//    }
// }
