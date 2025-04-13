// import { Queue } from 'bullmq';
// // import { getRedisConnection } from '../../config/redis';

// // export const connection = getRedisConnection();

// export const paymentQueue = new Queue('payment-processing', {
//    connection,
// });

// async function checkQueue() {
//    const waitingJobs = await paymentQueue.getWaiting();
//    const activeJobs = await paymentQueue.getActive();
//    console.log(
//       `Waiting Jobs: ${waitingJobs.length}, Active Jobs: ${activeJobs.length}`,
//    );
// }

// // checkQueue();
