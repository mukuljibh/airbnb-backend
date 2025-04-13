import Stripe from 'stripe';
import { Transaction } from '../../../models/reservation/transaction';
import { Reservation } from '../../../models/reservation/reservation';
import { Billing } from '../../../models/reservation/billing';
import mongoose from 'mongoose';
import { User } from '../../../models/user/user';
import { generateVerificationStatus } from '../../../utils/stripe-services/helper';
import { BankDetails } from '../../../models/user/bankDetails';
import { stripe } from '../../../controllers/general/reservation/general.reservation.controller';
import { reservationEmitter } from '../../../events/reservation/reservation.emitter';
export async function handlePaymentSucceeded(
   data: Stripe.Checkout.Session,
   eventId: string,
   session: mongoose.mongo.ClientSession,
) {
   const { metadata, status, payment_intent } = data;
   const invoice = await stripe.invoices.retrieve(data.invoice as string);
   // console.log(invoice);
   // Check if the event has already been processed
   // Update the Transaction document
   await Transaction.findOneAndUpdate(
      { reservationId: metadata?.reservationId },
      {
         stripeInvoiceId: invoice.id,
         paymentIntentId: payment_intent,
         paymentStatus: 'paid',
         type: 'PAYMENT',
         paymentAmount: data?.amount_total / 100,
         receiptUrl: invoice?.hosted_invoice_url,
      },
      { session },
   );

   // Update the Reservation document
   const res = await Reservation.findById(metadata?.reservationId).session(
      session,
   );
   if (!res) {
      return { success: true };
   }
   res.status = status as 'complete' | 'open' | 'processing' | 'cancelled';
   //remove ttl from reservation

   res.expiresAt = undefined;
   await res.save({ session: session });
   // Update the Billing document
   const billing = await Billing.findOne({
      reservationId: metadata?.reservationId,
   }).session(session);
   if (billing) {
      billing.currency = data.currency;
      billing.totalAmountPaid += data?.amount_total / 100;
      billing.remainingAmount -= data?.amount_total / 100;
      await billing.save({ session });
   }
   if (metadata?.guestEmail)
      reservationEmitter.emit('reservation:confirmed', {
         type: 'RESERVATION_CONFIRMATION',
         destination: metadata?.guestEmail,
         replacement: {
            thumbnail: metadata?.propertyThumbnail,
            checkInDate: metadata?.checkInDate,
            checkOutDate: metadata?.checkOutDate,
            guestEmail: metadata?.guestEmail,
            guestName: metadata?.guestName,
            propertyAddress: metadata?.propertyAddress,
            nights: metadata?.nights,
            propertyName: metadata?.propertyTitle,
            reservationCode: metadata?.reservationCode,
         },
      });

   return { success: true };
}

export async function handleDocumentVerified(
   data: Stripe.Identity.VerificationSession,
   eventId: string,
   session: mongoose.mongo.ClientSession,
) {
   const { id, status, metadata } = data;
   const verification = {
      id: id,
      status,
   };

   await User.updateOne(
      { _id: metadata.userId },
      { verification },
      { session },
   );

   return { success: true };
}
export async function handleRefundUpdate(
   data: Stripe.Refund,
   eventId: string,
   session: mongoose.mongo.ClientSession,
) {
   try {
      const { metadata } = data;
      // Update reservation status
      await Reservation.findByIdAndUpdate(
         metadata.reservationId,
         { status: 'cancelled', cancelledAt: new Date() },
         { session },
      );

      // Create refund transaction record

      const transaction = new Transaction({
         type: 'REFUND',
         stripeRefundId: data.id,
         paymentAmount: -Number(metadata.refundAmount),
         paymentStatus: 'refunded',
         reservationId: metadata.reservationId,
         billingId: metadata.billingId,
         referenceTxn: metadata.referenceTxn,
      });
      await transaction.save({ session });
      // Update billing record
      const billing = await Billing.findOne({
         _id: metadata.billingId,
      }).session(session);

      billing.hasRefunds = true;
      billing.totalRefunded =
         (billing.totalRefunded || 0) + Number(metadata.refundAmount);

      // You might want to verify if remainingAmount should be increased for refunds
      // This depends on your business logic
      billing.remainingAmount =
         (billing.remainingAmount || 0) + Number(metadata.refundAmount);

      await billing.save({ session });

      if (metadata?.guestEmail)
         reservationEmitter.emit('reservation:cancelled', {
            type: 'RESERVATION_CANCELLATION',
            destination: metadata?.guestEmail,
            replacement: {
               thumbnail: metadata?.thumbnail,
               checkInDate: metadata?.checkInDate,
               checkOutDate: metadata?.checkOutDate,
               guestEmail: metadata?.guestEmail,
               guestName: metadata?.guestName,
               propertyAddress: metadata?.propertyAddress,
               propertyName: metadata?.propertyTitle,
               reservationCode: metadata?.reservationCode,
               // cancellationReason: metadata?.cancellationReason,
            },
         });
      return { success: true };
   } catch (error) {
      console.error('Refund update failed:', error);
      throw error; // Re-throw to allow caller to handle or rollback the transaction
   }
}
export async function handleHostSetUpBankDetails(
   account: Stripe.Account,
   eventId: string,
   session: mongoose.mongo.ClientSession,
) {
   const { metadata, external_accounts } = account;
   const bankId = metadata.bankId;
   const verification = generateVerificationStatus(account);
   const bankDetails = external_accounts?.data?.find(
      (acc): acc is Stripe.BankAccount => acc.object === 'bank_account',
   );
   const person = await stripe.accounts.retrievePerson(
      account.individual.account,
      account.individual.id,
   );
   const bankInfo = bankDetails
      ? {
           bankName: bankDetails.bank_name || '',
           last4: bankDetails.last4 || '',
           currency: bankDetails.currency || '',
           country: bankDetails.country || '',
           routingNumber: bankDetails.routing_number || '',
           accountHolderName: `${person?.first_name} ${person?.last_name}`,

           ...verification,
        }
      : null;

   // console.log('person details--->', person);
   await BankDetails.findByIdAndUpdate(bankId, {
      ...bankInfo,
   }).session(session);

   return { success: true };
}

export async function handleHostBankDetailsUpdate(
   event: Stripe.ExternalAccount,
   eventId: string,
   session: mongoose.mongo.ClientSession,
) {
   // const { bank_name, account, last4 } = event;
   // const { metadata } = await stripe.accounts.retrieveExternalAccount(
   //    'acct_1R7tRQB1FyGYVWpz', // Account ID
   //    'ba_1R7u82B1FyGYVWpzfBa9ZC7o', // Bank Account ID
   // );

   // const bankId = metadata.bankId;
   // const verification = generateVerificationStatus(account);
   // const bankDetails = external_accounts?.data?.find(
   //    (acc): acc is Stripe.BankAccount => acc.object === 'bank_account',
   // );
   // const bankInfo = bankDetails
   //    ? {
   //         bankName: bank_name || '',
   //         last4: last4 || '',
   //         currency: currency || '',
   //         country: country || '',
   //         routingNumber: routing_number || '',
   //         ...verification,
   //      }
   //    : null;
   // console.log(bankInfo);
   // await BankDetails.findByIdAndUpdate(bankId, {
   //    ...bankInfo,
   // }).session(session);

   return { success: true };
}
