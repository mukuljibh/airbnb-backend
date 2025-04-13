import EventEmitter from 'events';
import { sendEmail } from '../../utils/email-service/emailServices.utils';
import { paymentProcessor } from '../../workers/payments/payment.processor';
import { JobQueues } from '../../models/jobQueues';

export const reservationEmitter = new EventEmitter();

reservationEmitter.on(
   'reservation:confirmed',
   ({ type, destination, replacement }) => {
      setImmediate(() => sendEmail(type, destination, replacement));
   },
);
reservationEmitter.on(
   'reservation:cancelled',
   ({ type, destination, replacement }) => {
      setImmediate(() => sendEmail(type, destination, replacement));
   },
);

reservationEmitter.on('reservation:updatePayment', async (job) => {
   try {
      console.log(
         `[${new Date().toISOString()}] [INFO] Processing job ID: ${job._id}`,
      );
      await paymentProcessor(job.payload);
      await JobQueues.deleteOne({ _id: job._id });

      console.log(
         `[${new Date().toISOString()}] [SUCCESS] Job ${job._id} processed and removed from JobQueues`,
      );
   } catch (error) {
      console.error(
         `[${new Date().toISOString()}] [ERROR] Failed to process job ${job._id}, will retry in 2 minutes. Error: ${error.message}`,
      );

      await JobQueues.updateOne(
         { _id: job._id },
         {
            $set: { status: 'pending' },
            $inc: { retries: 1 },
         },
      );

      console.warn(
         `[${new Date().toISOString()}] [WARN] Job ${job._id} marked as pending. Retry count incremented.`,
      );
   }
});

let pollingIntervalId = null;

export async function poolJobs(interval) {
   console.log(
      `[${new Date().toISOString()}] [INFO] Polling started. Interval set to ${interval} seconds`,
   );

   pollingIntervalId = setInterval(async () => {
      try {
         const pendingJobs = await JobQueues.find({
            status: 'pending',
            retries: { $lte: 5 },
         });

         if (pendingJobs.length === 0) {
            console.log(
               `[${new Date().toISOString()}] [DEBUG] No pending jobs found.`,
            );
            return;
         }

         console.log(
            `[${new Date().toISOString()}] [INFO] Found ${pendingJobs.length} pending jobs. Starting processing.`,
         );

         for (const job of pendingJobs) {
            await JobQueues.updateOne(
               { _id: job._id },
               {
                  $set: {
                     status: 'processing',
                     processingAt: new Date(),
                  },
               },
            );

            console.log(
               `[${new Date().toISOString()}] [DEBUG] Job ${job._id} marked as processing.`,
            );
            reservationEmitter.emit('reservation:updatePayment', job);
         }
      } catch (err) {
         console.error(
            `[${new Date().toISOString()}] [ERROR] Polling error: ${err.message}`,
         );
      }
   }, interval * 1000);
}

export function stopPolling() {
   if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      console.log(`[${new Date().toISOString()}] [INFO] Polling stopped.`);
   }
}
