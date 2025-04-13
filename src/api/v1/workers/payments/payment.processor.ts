import mongoose from 'mongoose';
import Stripe from 'stripe';
import { EventLogs } from '../../models/reservation/eventLogs';
import {
   handleDocumentVerified,
   handleHostSetUpBankDetails,
   handlePaymentSucceeded,
   handleRefundUpdate,
} from '../../workers/payments/utils/payments.utils';

export async function paymentProcessor(job) {
   const event = job as Stripe.Event;
   const session = await mongoose.startSession();
   console.log('job processing for event type -- >', event.type);

   try {
      const eventLog = await EventLogs.findOneAndUpdate(
         { eventId: event.id },
         { lastProcessAttempt: new Date(), $inc: { processAttempts: 1 } },
      );
      session.startTransaction();
      if (eventLog && eventLog.status === 'completed') {
         await session.abortTransaction();
         return { success: true, alreadyProcessed: true };
      }
      let handled = false;

      switch (event.type) {
         case 'checkout.session.completed':
            await handlePaymentSucceeded(event.data.object, event.id, session);
            handled = true;
            break;

         case 'identity.verification_session.verified':
         case 'identity.verification_session.canceled':
         case 'identity.verification_session.processing':
            await handleDocumentVerified(event.data.object, event.id, session);
            handled = true;
            break;

         case 'charge.refund.updated':
            await handleRefundUpdate(event.data.object, event.id, session);
            handled = true;
            break;

         case 'account.updated':
            await handleHostSetUpBankDetails(
               event.data.object,
               event.id,
               session,
            );
            handled = true;
            break;

         // case 'account.external_account.created':
         //    await handleHostBankDetailsUpdate(
         //       event.data.object,
         //       event.id,
         //       session,
         //    );
         //    handled = true;
         //    break;
         default:
            console.warn(`Unhandled event type: ${event.type}`);
            break;
      }
      if (!handled) {
         await session.abortTransaction();
         return;
      }
      await session.commitTransaction();
      await EventLogs.findOneAndUpdate(
         { eventId: event.id },
         { status: 'complete', completedAt: new Date() },
      );
      console.log('job processing successfully completed');
   } catch (error) {
      await session.abortTransaction();
      console.error(`Error processing job ${job.id}:`, error);
      throw error;
   } finally {
      await session.endSession();
   }
}
