import Stripe from 'stripe';
import { EventLogs } from '../../models/reservation/eventLogs';
import {
   handleDocumentVerified,
   handlePaymentSucceeded,
   handleRefundUpdate,
   handleSessionComplete,
} from './handler/payments.handler';

import { logISTTimeStamp } from '../../utils/dates/dates.utils';
import { dispatchNotification } from '../../controllers/common/notifications/services/dispatch.service';
import { withMongoTransaction } from '../../utils/mongo-helper/mongo.utils';

const ISTTimeStamp = logISTTimeStamp();

export async function paymentProcessor(job) {

   let notificationPayload;

   const event = job as Stripe.Event;

   console.log('job processing for event type -- >', event.type);

   try {
      // console.log({ event, ec: event.id });

      const eventLog = await EventLogs.findOne({ eventId: event.id });

      if (!eventLog) {
         console.log(
            `[${ISTTimeStamp}] [INFO] Event log is missing cannot process it further from processor.`,
         );

         return { success: false };
      }

      // return if this event is already marked as complete
      if (eventLog.status === 'complete') {

         console.warn(
            `[${ISTTimeStamp}] [INFO] This event --> ${eventLog.eventId} is already completed `,
         );

         return { success: true, alreadyProcessed: true };
      }

      //update eventLogs to processing that indicate ongoing activity on the event

      await EventLogs.updateOne(
         { eventId: event.id },
         {
            lastProcessAttempt: new Date(),
            status: 'processing',
            $inc: { processAttempts: 1 },
         },
      );


      await withMongoTransaction(async (session) => {
         let handled = false;

         switch (event.type) {
            // This handler invokes when payment is completed by client. does not guarantee successfull and verified payment
            case 'checkout.session.completed':
               await handleSessionComplete(
                  event.data.object,
                  event.id,
                  session,
               );
               handled = true;
               break;

            // This handler invokes when payment is successfully recieved by payment gateway.
            case 'payment_intent.succeeded': {
               const payloadData = await handlePaymentSucceeded(
                  event.data.object,
                  event.id,
                  session,
               );
               notificationPayload = payloadData.notificationPayload;
               handled = true;
               break;
            }

            // This handler invokes when there is updation going on requested refund
            case 'charge.refund.updated': {
               const payloadData = await handleRefundUpdate(
                  event.data.object,
                  event.id,
                  session,
               );
               notificationPayload = payloadData.notificationPayload;
               handled = true;
               break;
            }

            case 'identity.verification_session.verified': {


               // case 'identity.verification_session.canceled':
               // case 'identity.verification_session.processing':
               // case 'identity.verification_session.requires_input':
               const payloadData = await handleDocumentVerified(
                  event.data.object,
                  event.id,
                  session,
               );
               handled = true;
               notificationPayload = payloadData?.notificationPayload;
               break;
            }

            // case 'account.updated':
            //    await handleHostSetUpBankDetails(
            //       event.data.object,
            //       event.id,
            //       session,
            //    );
            //    handled = true;
            //    break;

            // case 'account.external_account.created':
            //    await handleHostBankDetailsUpdate(
            //       event.data.object,
            //       event.id,
            //       session,
            //    );
            //    handled = true;
            //    break;
            default:
               handled = true;
               console.warn(`Unhandled event type: ${event.type}`);
               break;
         }

         if (!handled) {
            throw new Error('Task not handled properly');
         }

         //Update event log to complete so that if wont processed again anyways.
         await EventLogs.updateOne(
            { eventId: event.id },
            { status: 'complete', completedAt: new Date() },
            { session },
         );

         //send notification right away after committing
         if (notificationPayload)
            dispatchNotification({ recipients: notificationPayload });

         console.log(
            `[${ISTTimeStamp}] [INFO] Job processing successfully completed`,
         );
      })


   } catch (error) {

      await EventLogs.updateOne({ eventId: event.id }, { status: 'failed' });

      console.error(
         `[${ISTTimeStamp}] [ERROR] Error processing job --> ${job.id}:`,
         error,
      );

      //throwing error for retry in the next scheduling time.
      throw error;

   }
}
