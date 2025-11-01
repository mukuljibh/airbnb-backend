import Stripe from 'stripe';
import { PromoUsage } from '../../../../models/promo-code/promoUsage';
import mongoose, { ClientSession } from 'mongoose';
import moment from 'moment';
import { ITransaction, Transaction } from '../../../../models/reservation/transaction';
import { TypePopulatedProperty, TypeRefundMeta } from '../types/general.reservation.controller.types';

import { format } from 'date-fns';
import { stripe } from '../../../../config/stripe';
import { ApiError } from '../../../../utils/error-handlers/ApiError';
import { Reservation } from '../../../../models/reservation/reservation';
import { Property } from '../../../../models/property/property';
import { IPropertyRules } from '../../../../models/property/types/property.model.types';
import { User } from '../../../../models/user/user';
import { ApiResponse } from '../../../../utils/error-handlers/ApiResponse';
import { createRecipient, dispatchNotification } from '../../../common/notifications/services/dispatch.service';
import { formatDate, formatDateRange } from '../../../../utils/dates/dates.utils';
import getSymbolFromCurrency from 'currency-symbol-map';
import { concatCurrencyWithPrice } from '../../../../utils/currency/currency.utils';
import { withMongoTransaction } from '../../../../utils/mongo-helper/mongo.utils';
import env from '../../../../config/env';

// in future this function will handle various type of discounts for now it is harded coded
export async function discountCouponGenerator(
   discountBreakdown: {
      lengthDiscount: number;
   },
   stripe: Stripe,
) {
   let coupon;
   if (discountBreakdown?.lengthDiscount) {
      coupon = await stripe.coupons.create({
         name: 'Long Stay Discount',
         amount_off: parseFloat((discountBreakdown.lengthDiscount * 100).toFixed(2)),
         currency: 'inr',
         duration: 'once',
      });
   }
   return coupon ? [{ coupon: coupon.id }] : undefined;
}

export async function checkPromoValidForUser(
   promoId: mongoose.Types.ObjectId,
   userId: mongoose.Types.ObjectId | string,
   userLimit: number,
   session?: ClientSession,
) {
   const query = PromoUsage.countDocuments({ promoCodeId: promoId, userId });
   if (session) query.session(session);
   const promoUsedCount = await query;

   return {
      isValid: promoUsedCount < userLimit,
      message:
         promoUsedCount < userLimit
            ? undefined
            : `You've reached the usage limit for this promo code. This offer is only valid ${userLimit} times per customer.`,
   };
}

export function calculateRefundAmount(
   refundPolicy: 'flexible' | 'moderate' | 'strict' | 'non-refundable',
   checkInDate: Date,
   checkInTime: string,
   totalPayment: number,
) {
   const currentDate = moment.utc(new Date()).tz('Asia/Kolkata');

   let dateOfCheckin = moment.utc(checkInDate);

   dateOfCheckin = dateOfCheckin.tz('Asia/Kolkata').set({
      hour: parseInt(checkInTime.split(':')[0]),
      minute: parseInt(checkInTime.split(':')[1]),
      second: 0,
      millisecond: 0,
   });
   const dayDifference = dateOfCheckin.diff(currentDate, 'days');
   if (dayDifference <= 2) {
      return {
         refundAmt: 0,
         message:
            'As per our refund policy, cancellations made within 48 hours of the check-in date are not eligible for a refund.',
      };
   } else {
      return {
         refundAmt: totalPayment,
         message:
            'You are eligible for a full refund as your cancellation is outside the 48-hour window.',
      };
   }

   // const chargePercentage = 10;
   // switch (refundPolicy) {
   //    case 'flexible':
   //       if (todayDate.isBefore(moment(checkInDate))) {
   //          return totalPayment;
   //       }
   //       break;
   //    case 'moderate':
   //    if (todayDate.isBefore(moment(checkInDate).subtract(5, 'days'))) {
   //       return totalPayment;
   //    }
   //       break;
   //    case 'non-refundable':
   //       if (todayDate.isBefore(moment(checkInDate))) {
   //          return totalPayment;
   //       }
   //       break;
   //    case 'strict':
   //       if (todayDate.isBefore(moment(checkInDate))) {
   //          return totalPayment;
   //       }
   //       break;
   // }
}







export async function processStripeRefund(
   transaction: ITransaction,
   refundAmt: number,
   meta: Partial<TypeRefundMeta>,
): Promise<Stripe.Response<Stripe.Refund>> {

   const idempotencyKey = `refund-${transaction._id}`;

   const { user, property, reservation, cancelledBy, reason } = meta

   const host = await User.findOne({ _id: reservation?.hostId }).select('firstName lastName')
   const hostName = `${host.firstName} ${host.lastName}`
   const refund = await stripe.refunds.create(
      {
         payment_intent: transaction.paymentIntentId,
         reason: 'requested_by_customer',
         metadata: {
            server_url: env.SERVER_URL,
            userId: String(user._id),
            hostId: String(reservation.hostId),
            hostName: hostName,
            billingId: String(transaction.billingId),
            reservationId: String(reservation._id),
            referenceTxn: String(transaction._id),
            refundAmount: refundAmt,
            thumbnail: property.thumbnail,
            cancelledBy,
            checkInDate: String(
               format(reservation.checkInDate, 'MMMM dd, yyyy'),
            ),
            checkOutDate: String(
               format(reservation.checkOutDate, 'MMMM dd, yyyy'),
            ),
            guestEmail: user.email,
            guestName: `${user.firstName} ${user.lastName}`,
            propertyAddress: property.location.address,
            propertyTitle: property.title,
            propertyPlaceType: property.propertyPlaceType,
            reservationCode: reservation.reservationCode,
            cancellationReason: reason,
            currency: transaction.currency
         },
      },
      { idempotencyKey },
   );

   const payload = createRecipient('email', {
      type: 'REFUND_INTIATED',
      destination: user?.email,
      replacement: {
         thumbnail: property?.thumbnail,
         propertyName: property?.title,
         refundAppliedDate: formatDate(new Date(), true),
         propertyPlaceType: property.propertyPlaceType,
         hostName: hostName,
         formattedDateRange: formatDateRange(
            reservation?.checkInDate,
            reservation?.checkOutDate,
            reservation.numberOfGuests
         ),
         reservationCode: reservation.reservationCode,
         refundAmount: concatCurrencyWithPrice(
            transaction.currency,
            reservation.totalPrice as number
         ),
         currencySymbol: getSymbolFromCurrency(transaction.currency),
      },
   });


   dispatchNotification({ recipients: [payload] })

   return refund;
}

export interface IHandleCancel {

   filter: {
      _id: mongoose.Types.ObjectId;
      hostId?: mongoose.Types.ObjectId;
      userId?: mongoose.Types.ObjectId,

      status: {
         $in: string[];
      };
   },
   userId: mongoose.Types.ObjectId;
   reason: string,
   cancelledBy: string

}
export async function handleCancelOrder(
   options: IHandleCancel
) {

   let refundAmt = 0;
   let refundAlertMessage = '';
   let refundTransactions: ITransaction[] = [];
   let refundMeta: Partial<TypeRefundMeta> = {};

   const { filter, userId, reason, cancelledBy } = options

   const user = await User.findOne(userId).select("firstName lastName email")
   try {

      await withMongoTransaction(async (session) => {
         const rawReservation = Reservation.findOneAndUpdate(
            { ...filter },
            { $set: { status: 'processing' } },
            { new: true }
         )
            .select('propertyId checkOutDate checkInDate reservationCode hostId totalPrice numberOfGuests isInstantBooking')
            .session(session);


         const rawTransactions = Transaction.find({
            reservationId: filter._id,
            type: 'PAYMENT',
         })
            .select("paymentIntentId billingId currency paymentAmount totalPrice")
            .session(session);


         const [transactions, reservation] = await Promise.all([rawTransactions, rawReservation])


         if (!reservation) {
            throw new ApiError(400, 'No reservation found to cancel');
         }

         if (!transactions || transactions.length === 0) {
            throw new ApiError(400, 'No transactions found for refund');
         }

         const rawProperty = Property.findById(reservation.propertyId)
            .populate<{ propertyRules: IPropertyRules }>({
               path: 'propertyRules',
               select: 'cancellationPolicy checkInTime',
            })
            .session(session);



         const [property] = await Promise.all([rawProperty])

         const guestUser = user


         const { refundAmt: amt, message } = calculateRefundAmount(
            property.propertyRules.cancellationPolicy.type,
            reservation.checkInDate,
            property.propertyRules.checkInTime,
            transactions[0].paymentAmount,
         );

         refundAmt = amt;
         refundAlertMessage = message;
         refundTransactions = transactions;



         refundMeta = {
            user: guestUser,
            property: property as TypePopulatedProperty,
            reservation,
            cancelledBy,
            reason,
         };


         await Promise.all(
            refundTransactions.map((transaction) =>
               processStripeRefund(transaction, refundAmt, refundMeta),
            ),
         );
      })



      return new ApiResponse(200, refundAlertMessage)

   } catch (err) {

      console.error(`[handleCancelOrder] Error:`, err);
      throw err

   }
}