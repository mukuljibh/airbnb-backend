import Stripe from 'stripe';
import { Transaction } from '../../../models/reservation/transaction';
import { Reservation } from '../../../models/reservation/reservation';
import { Billing } from '../../../models/reservation/billing';
import mongoose from 'mongoose';
import { User } from '../../../models/user/user';
import { generateVerificationStatus } from '../../../utils/stripe-services/helper';
import { BankDetails } from '../../../models/user/bankDetails';
import { stripe } from '../../../config/stripe';
import { createRecipient, NotificationRecipient } from '../../../controllers/common/notifications/services/dispatch.service';
import { zeroDecimalCurrencies } from '../../../constant/currency.constant';
import moment from 'moment';
import { scheduleReservationCancellationJobs, scheduleReservationConfirmationJobs } from '../../../controllers/general/reservation/jobs';

export async function handleSessionComplete(
   data: Stripe.Checkout.Session,
   eventId: string,
   session: mongoose.ClientSession,
) {
   const { metadata } = data;

   // Update the Reservation document

   await Reservation.findOneAndUpdate(
      { _id: metadata?.reservationId, status: 'open' },
      {
         $set: {
            status: 'processing',
         },
         $unset: {
            expiresAt: 1,
         },
      },
      { session },
   );
   await Transaction.findOneAndUpdate(
      { _id: metadata?.transactionId, paymentStatus: 'open' },
      {
         $set: {
            paymentStatus: 'processing',
         },
      },
      {
         session,
      },
   );

   return { success: true };
}

export async function handlePaymentSucceeded(
   data: Stripe.PaymentIntent,
   eventId: string,
   session: mongoose.mongo.ClientSession,
) {
   let notificationPayload: NotificationRecipient[] | null;

   const {
      id: paymentIntentId,
      amount_received,
      metadata,
      latest_charge,
   } = data;

   const {
      reservationId,
      transactionId,
      // userId,
      // guestEmail,
      // checkInDate,
      // checkOutDate,
      // propertyThumbnail,
      // propertyAddress,
      // nights,
      // propertyTitle,
      // reservationCode,
      // hostId,
      // guestName,
      hasInstantBooking
   } = metadata || {};

   const {
      id: stripeTransactionId,
      billing_details,
      payment_method_details,
      payment_method,
      receipt_url,
   } = await stripe.charges.retrieve(latest_charge as string);

   const transactionCurrency = data.currency.toUpperCase()

   //   // Update the Reservation document
   const paymentMethod = payment_method_details;
   const cardInfo = {
      id: payment_method,
      brand: paymentMethod?.card?.brand,
      last4: paymentMethod?.card.last4,
      expMonth: paymentMethod?.card?.exp_month,
      expYear: paymentMethod?.card?.exp_year,
   };

   const status = hasInstantBooking == 'true' ? 'complete' : "awaiting_confirmation"

   const specialCaseCurrencies = ["UGX", "ISK"];
   const zeroDecimalCurrencies = [
      "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF",
      "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV",
      "XAF", "XOF", "XPF"
   ];

   let paidAmount: number;

   if (zeroDecimalCurrencies.includes(transactionCurrency)) {
      //--> stripe send inflated amount with special currency
      paidAmount = specialCaseCurrencies.includes(transactionCurrency)
         ? amount_received / 100
         : amount_received;
   } else {
      paidAmount = amount_received / 100;
   }

   console.log({ amount_received, paidAmount, transactionCurrency });
   const now = moment.utc(new Date).toDate()

   const setField: Record<string, any> = {
      status,
      totalPrice: paidAmount,
   }

   if (status === "complete") {
      setField.confirmedAt = now
   }

   const reservation = await Reservation.findByIdAndUpdate(
      metadata?.reservationId,
      {
         $set: setField,
         $unset: {
            expiresAt: 1,
         },
      },
      { session },
   );


   const transaction = await Transaction.findByIdAndUpdate(
      transactionId,
      {
         $set: {
            paymentIntentId: paymentIntentId,
            paymentStatus: 'paid',
            stripeTransactionId: stripeTransactionId,
            type: 'PAYMENT',
            paymentMethod: cardInfo,
            paymentAmount: paidAmount,
            receiptUrl: receipt_url,
         },
      },
      {
         session,
         new: true,
      },
   );


   await Billing.updateOne(
      { _id: transaction.billingId },
      {
         $set: {
            billingDetails: billing_details,
         },
         $inc: {
            totalAmountPaid: paidAmount,
            remainingAmount: -paidAmount
         },
      },
      { session },
   );

   scheduleReservationConfirmationJobs({ checkInDate: reservation.checkInDate, checkOutDate: reservation.checkOutDate, reservationId, status, reservedAt: now })
      .then(() => console.log('reservation jobs register successfully'))
      .catch(() => { console.log('error scheduling confirmation reservation jobs') })

   return { success: true, notificationPayload };
}

export async function handleRefundUpdate(
   data: Stripe.Refund,
   eventId: string,
   session: mongoose.ClientSession,
) {
   try {
      const now = moment.utc(new Date()).toDate()
      let notificationPayload: NotificationRecipient[] | null;
      const { metadata } = data;

      const { cancelledBy, cancellationReason } = metadata

      const setFields: Record<string, unknown> = {
         cancellationReason: cancellationReason,
         status: 'cancelled',
         cancelledAt: now,
         cancelledBy: cancelledBy
      }
      // Update reservation status
      if (cancelledBy == 'host') {
         setFields.hostDecisionAt = now
         setFields.hostDecision = 'rejected'

      }
      const reservation = await Reservation.findByIdAndUpdate(
         metadata.reservationId,
         { $set: setFields },
         { session, new: true },
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
         currency: metadata.currency,
      });
      await transaction.save({ session });
      // Update billing record

      await Billing.findByIdAndUpdate(
         metadata.billingId,
         {
            $set: {
               hasRefunds: true,
            },
            $inc: {
               totalRefunded: Number(metadata.refundAmount),
               remainingAmount: Number(metadata.refundAmount),
            },
         },
         { session, new: true },
      );
      scheduleReservationCancellationJobs({ reservationId: metadata.reservationId })
         .then(() => console.log('reservation cancellation jobs register successfully'))
         .catch(() => { console.log('error scheduling cancellation reservation jobs') })


      return { success: true, notificationPayload };
   } catch (error) {
      console.error('Refund update failed:', error);
      throw error; // Re-throw to allow caller to handle or rollback the transaction
   }
}

export async function handleDocumentVerified(
   data: Stripe.Identity.VerificationSession,
   eventId: string,
   session: mongoose.ClientSession,
) {

   const { id, status, metadata } = data;
   const verification = {
      id: id,
      status,
   };

   const user = await User.findOneAndUpdate(
      { _id: metadata.userId, 'verification.status': { $ne: 'verified' } },
      { $set: { verification } },
      { session, new: true },
   );

   if (!user) {
      console.warn('User already verified')
      return { success: true };

   }

   const payload = createRecipient('both', {
      emailOptions: {
         type: 'KYC_VERIFIED',
         destination: user?.email,
         replacement: {
            hostName: user?.firstName,
         },
      },
      notificationOptions: {
         redirectKey: 'user-page',
         metadata: { userId: metadata.userId },
         userId: metadata.userId,
         title: 'KYC Verification Successful',
         message: `Congratulations ${user?.firstName}, your KYC documents have been successfully verified.`,
         visibleToRoles: ['host'],
      }

   });

   return { success: true, notificationPayload: [payload] };

}

export async function handleHostSetUpBankDetails(
   account: Stripe.Account,
   eventId: string,
   session: mongoose.ClientSession,
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

// export async function handleHostBankDetailsUpdate(
//    event: Stripe.ExternalAccount,
//    eventId: string,
// session: mongoose.ClientSession,
// ) {
//    // const { bank_name, account, last4 } = event;
//    // const { metadata } = await stripe.accounts.retrieveExternalAccount(
//    //    'acct_1R7tRQB1FyGYVWpz', // Account ID
//    //    'ba_1R7u82B1FyGYVWpzfBa9ZC7o', // Bank Account ID
//    // );

//    // const bankId = metadata.bankId;
//    // const verification = generateVerificationStatus(account);
//    // const bankDetails = external_accounts?.data?.find(
//    //    (acc): acc is Stripe.BankAccount => acc.object === 'bank_account',
//    // );
//    // const bankInfo = bankDetails
//    //    ? {
//    //         bankName: bank_name || '',
//    //         last4: last4 || '',
//    //         currency: currency || '',
//    //         country: country || '',
//    //         routingNumber: routing_number || '',
//    //         ...verification,
//    //      }
//    //    : null;
//    // console.log(bankInfo);
//    // await BankDetails.findByIdAndUpdate(bankId, {
//    //    ...bankInfo,
//    // }).session(session);

//    return { success: true };
// }
