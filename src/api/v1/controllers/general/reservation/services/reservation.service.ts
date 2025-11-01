import mongoose from 'mongoose';
import { format } from 'date-fns';
import Stripe from 'stripe';
import { Price } from '../../../../models/price/price';
import { Reservation } from '../../../../models/reservation/reservation';
import { IUser } from '../../../../models/user/types/user.model.types';
import { IProperty } from '../../../../models/property/types/property.model.types';
import { Billing } from '../../../../models/reservation/billing';
import { Transaction } from '../../../../models/reservation/transaction';
import { PromoCode } from '../../../../models/promo-code/promoCode';
import { PromoUsage } from '../../../../models/promo-code/promoUsage';
import { checkPromoValidForUser } from './payment.service';
import { IReservation } from '../../../../models/reservation/types/reservation.model.types';
import { User } from '../../../../models/user/user';
import { BillingProps } from '../../../../models/reservation/billing';
import { zeroDecimalCurrencies } from '../../../../constant/currency.constant';
import getSymbolFromCurrency from 'currency-symbol-map';
import env from '../../../../config/env';
import { validateStripeAmount } from './payment.helper';
import { createPriceService } from '../../../../models/price/services/price.service';
import { BillingDetails } from '../../../../models/price/types/price.model.type';
import { createReservationGatewayService } from './gateway/gateway';

interface ICreateReservation {
   userId: mongoose.Types.ObjectId,
   propertyId: mongoose.Types.ObjectId,
   hostId: mongoose.Types.ObjectId,
   checkIn: Date,
   checkOut: Date,
   adult: number,
   child: number,
   guestDetails: string,
   hasInstantBooking: boolean;
   billingDetails: BillingDetails
}
export class PaymentService {
   private stripe: Stripe;
   private session: mongoose.ClientSession | null;
   private currency: string
   constructor(
      stripeInstance: Stripe,
      mongoSession: mongoose.ClientSession | null = null,
      currency: string
   ) {
      this.stripe = stripeInstance;
      this.session = mongoSession;
      this.currency = currency;

   }


   private async createInitialReservation(
      options: ICreateReservation
   ) {
      const { userId, hostId, propertyId, checkIn, checkOut,
         adult, child, billingDetails, guestDetails, hasInstantBooking } = options
      // Create reservation instance to get _id before saving
      const reservation = new Reservation({
         hostId,
         propertyId,
         userId,
         isInstantBooking: hasInstantBooking,
         checkInDate: checkIn,
         checkOutDate: checkOut,
         numberOfGuests: adult + child,
         totalPrice: billingDetails.totalPrice,
      });

      const billing = new Billing({
         ...billingDetails,
         guestDetails,
         reservationId: reservation._id,
      });

      const [newBilling, newReservation] = await Promise.all([
         billing.save({ session: this.session }),
         reservation.save({ session: this.session }),
      ]);

      return { newBilling, newReservation };
   }

   private async calculateBillingDetails(
      property: IProperty,
      checkIn: Date,
      checkOut: Date,
      child: number,
      adult: number,
      userId?: string,
      promoCode?: string,
   ) {
      const price = await Price.findOne({ _id: property.price }).session(
         this.session,
      );

      const priceService = createPriceService(price)

      return await priceService.calculateTotalPrice({
         checkIn,
         checkOut,
         childCount: child,
         adultCount: adult,
         guestRequestedCurrency: this.currency,
         promoCode,
         userId
      })
      // return await price.calculateTotalPrice(
      //    checkIn,
      //    checkOut,
      //    child,
      //    adult,
      //    userId,
      //    promoCode,
      //    this.currency
      // );
   }

   private createLineItems(
      billing: BillingProps,
      propertyDetails: IProperty,
      { checkInDate, checkOutDate },
   ) {
      const nights = billing.numberOfNights;
      const checkIn = new Date(checkInDate).toDateString();
      const checkOut = new Date(checkOutDate).toDateString();
      const guests = billing.guest.adult + billing.guest.child;
      const currency = (billing?.currencyExchangeRate?.targetCurrency)?.toLowerCase()
      const conversionFactor = zeroDecimalCurrencies.includes(currency.toUpperCase()) ? 1 : 100

      const processAmount = (amount: number) => {
         const currencyCode = currency.toUpperCase();
         // --- > As per stripe documentation we need to handle zero decimal currency cases.
         // Special cases for currencies with backwards compatibility requirements
         if (currencyCode === 'UGX' || currencyCode === 'ISK') {
            // UGX and ISK: multiply by 100 (backwards compatibility) and ensure divisible by 100
            const convertedAmount = Math.round(amount * 100);
            return Math.round(convertedAmount / 100) * 100;
         }

         // Special cases for HUF and TWD payouts (but for charges, treat normally)
         // Note: This is primarily for payouts, but we'll apply the same logic for consistency
         // if (currencyCode === 'HUF' || currencyCode === 'TWD') {
         //    // For charges: multiply by 100 (normal decimal handling)
         //    const convertedAmount = Math.round(amount * 100);
         //    // But ensure result is divisible by 100 for payout compatibility
         //    return Math.round(convertedAmount / 100) * 100;
         // }

         // For other currencies, use normal conversion factor
         return Math.round(amount * conversionFactor);
      };

      const discountLine =
         billing.discounts > 0
            ? `Discount Applied: ${getSymbolFromCurrency(billing?.currencyExchangeRate?.targetCurrency)} ${billing?.discounts?.toFixed(2)} (Includes length & promo discounts)`
            : 'No discounts applied';

      const description = `Stay: ${nights} night(s) | Check-in: ${checkIn} | Check-out: ${checkOut} | Guests: ${guests} (Adults: ${billing.guest.adult}, Children: ${billing.guest.child}) | ${discountLine}`;

      // Use the helper function for all amount calculations
      const discountedUnitAmount = processAmount(billing.priceAfterDiscounts);

      const totalFeesApplicable = processAmount(
         (billing?.additionalFees?.cleaning || 0) + (billing?.additionalFees?.service || 0)
      );

      const totalTaxApplicable = processAmount(billing?.additionalFees?.tax || 0);

      const totalPlatformFeesApplicable = processAmount(billing?.additionalFees?.platformFees || 0);
      const total = discountedUnitAmount + totalFeesApplicable + totalTaxApplicable + totalPlatformFeesApplicable
      //validate totalamount before creating stripe checkout payment object 
      validateStripeAmount(total, currency)
      const result = [
         {
            price_data: {
               currency: currency.toUpperCase(), // Changed to uppercase for consistency
               product_data: {
                  name: propertyDetails.title,
                  description: description,
                  images: [propertyDetails?.thumbnail]
               },
               unit_amount: discountedUnitAmount,
            },
            quantity: 1,
         },
         {
            price_data: {
               currency: currency.toUpperCase(),
               product_data: {
                  name: 'Servicing & Cleaning Fee',
                  description:
                     'Charges for property servicing, maintenance, and cleaning.',
               },
               unit_amount: totalFeesApplicable
            },
            quantity: 1,
         },
         {
            price_data: {
               currency: currency.toUpperCase(),
               product_data: {
                  name: 'GST Tax',
                  description: 'Applicable Goods and Services Tax (GST)',
               },
               unit_amount: totalTaxApplicable
            },
            quantity: 1,
         },
         {
            price_data: {
               currency: currency.toUpperCase(),
               product_data: {
                  name: 'Platform Fees',
                  description: 'Fee for maintaining a secure and reliable booking experience',
               },
               unit_amount: totalPlatformFeesApplicable
            },
            quantity: 1,
         },
      ];


      return result
   }

   private createSessionMetadata(
      sessionUserId: mongoose.Types.ObjectId,
      reservationData: {
         _id: mongoose.Types.ObjectId;
         checkInDate: Date;
         checkOutDate: Date;
         reservationCode: string;
         guestCount: number;
         hostId: string;
         transactionId: mongoose.Types.ObjectId;
      },
      propertyDetails: IProperty,
      userDetails: IUser,
      billing: BillingProps,
   ) {
      const { isHaveInstantBooking } = propertyDetails.propertyRules as any

      return {
         server_url: env.SERVER_URL,
         userId: String(sessionUserId),
         reservationId: String(reservationData._id),
         transactionId: String(reservationData.transactionId),
         hostId: reservationData.hostId,
         hasInstantBooking: isHaveInstantBooking,
         guestName: `${userDetails.firstName} ${userDetails.lastName}`,
         checkInDate: String(
            format(reservationData.checkInDate, 'MMMM dd, yyyy'),
         ),
         checkOutDate: String(
            format(reservationData.checkOutDate, 'MMMM dd, yyyy'),
         ),
         guestCount: reservationData.guestCount,
         guestEmail: userDetails.email,
         propertyTitle: propertyDetails.title,
         reservationCode: reservationData.reservationCode,
         propertyAddress: propertyDetails.location.address,
         propertyThumbnail: propertyDetails.thumbnail,
         nights: billing.numberOfNights,
         promoCodeId: String(billing?.promoApplied?.promoCodeId),
      };
   }

   public async initiatePayment(
      user: IUser,
      newReservation: IReservation,
      billing: BillingProps,
      propertyDetails: IProperty,
      clientType: 'Mobile' | undefined,
   ) {
      const {
         _id: reservationId,
         checkInDate,
         checkOutDate,
         hostId,
         numberOfGuests,
         userId,
         reservationCode,
      } = newReservation;

      const successUrl =
         clientType == 'Mobile'
            ? `${env.MOBILE_URL}?screen=PropertyBookingDetails&reservationId=${reservationId}`
            : `${env.GUEST_URL}/booking-process/${reservationId}`;

      const cancelUrl =
         clientType == 'Mobile'
            ? `${env.MOBILE_URL}?screen=PropertyBookingDetails&reservationId=${reservationId}`
            : `${env.GUEST_URL}/booking-process/${reservationId}`;


      const userDetails = await User.findById(user._id)
         .select('email firstName lastName')
         .session(this.session);

      // apply coupon
      const coupon = await PromoCode.findOne({
         _id: billing?.promoApplied?.promoCodeId,
      }).session(this.session);

      if (coupon) {
         const couponValidity = await coupon.validatePromoCode(
            billing.totalbasePrice,
            this.currency
         );

         if (couponValidity.isValid) {
            const isPromoValidForUser = await checkPromoValidForUser(
               coupon._id,
               user._id,
               coupon.maxPerUser,
               this.session,
            );

            if (isPromoValidForUser.isValid) {
               const promoUsage = new PromoUsage({
                  reservationId: reservationId,
                  userId: userId,
                  promoCodeId: billing?.promoApplied?.promoCodeId,
                  appliedOn: new Date(),
               });

               await promoUsage.save({ session: this.session });
               await coupon.incrementUsedCount(this.session);
            }
         }
      }
      const transaction = new Transaction({
         reservationId: reservationId,
         billingId: billing._id,
         paymentAmount: billing.remainingAmount,
         type: 'PAYMENT',
         currency: billing.currencyExchangeRate.targetCurrency
      });
      const metaData = this.createSessionMetadata(
         user._id,
         {
            _id: reservationId,
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            reservationCode: reservationCode,
            hostId: String(hostId),
            guestCount: numberOfGuests,
            transactionId: transaction._id,
         },
         propertyDetails,
         userDetails,
         billing,
      );

      const line_items = this.createLineItems(billing, propertyDetails, {
         checkInDate: checkInDate,
         checkOutDate: checkOutDate,
      })

      const session = await createReservationGatewayService('stripe', 'payment_link', {
         line_items,
         metadata: { ...metaData, cancelUrl, successUrl }
      })

      transaction.stripeSessionId = session.sessionId;
      await transaction.save({ session: this.session });

      return {
         sessionId: session.sessionId,
         reservationId: reservationId,
         url: session.url,
      };
   }

   public async createReservation(
      property: IProperty,
      user: IUser,
      propertyId: mongoose.Types.ObjectId,
      checkIn: Date,
      checkOut: Date,
      adult: number,
      child: number,
      guestDetails,
      promoCode?: string,
   ) {
      const billingDetails = await this.calculateBillingDetails(
         property,
         checkIn,
         checkOut,
         child,
         adult,
         user.id,
         promoCode,
      );

      const { isHaveInstantBooking } = property.propertyRules as any

      const { newBilling, newReservation } =
         await this.createInitialReservation(
            {
               userId: user._id,
               propertyId,
               hasInstantBooking: isHaveInstantBooking,
               hostId: property.hostId,
               checkIn,
               checkOut,
               adult,
               child,
               guestDetails,
               billingDetails
            },
         );

      return { newBilling, newReservation };
   }
}
