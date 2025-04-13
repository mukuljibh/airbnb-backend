import mongoose from 'mongoose';
import { format } from 'date-fns';
import Stripe from 'stripe';
import { Property } from '../../../../models/property/property';
import { Price } from '../../../../models/price/price';
import { Reservation } from '../../../../models/reservation/reservation';
import { ApiError } from '../../../../utils/error-handlers/ApiError';
import { IUser } from '../../../../models/user/types/user.model.types';
import { IProperty } from '../../../../models/property/types/property.model.types';
import { Billing, BillingProps } from '../../../../models/reservation/billing';
import { Transaction } from '../../../../models/reservation/transaction';
import { PromoCode } from '../../../../models/promo-code/promoCode';
import { PromoUsage } from '../../../../models/promo-code/promoUsage';
import { checkPromoValidForUser } from './general.reservation.utils';
import moment from 'moment';

export class PaymentService {
   private stripe: Stripe;
   private session: mongoose.ClientSession | null;

   constructor(
      stripeInstance: Stripe,
      mongoSession: mongoose.ClientSession | null = null,
   ) {
      this.stripe = stripeInstance;
      this.session = mongoSession;
   }

   private async findReservation(
      reservationId: mongoose.Types.ObjectId,
      userId: mongoose.Types.ObjectId,
   ) {
      return await Reservation.findOne({
         _id: reservationId,
         userId: userId,
         status: 'open',
      })
         .populate<{ userId: IUser; propertyId: IProperty }>(
            'propertyId userId',
         )
         .session(this.session);
   }

   private async createInitialReservation(
      userId: mongoose.Types.ObjectId,
      propertyId: mongoose.Types.ObjectId,
      hostId: mongoose.Types.ObjectId,
      checkIn: Date,
      checkOut: Date,
      adult: number,
      child: number,
      billingDetails: BillingProps,
   ) {
      const reservation = new Reservation({
         hostId: hostId,
         propertyId: propertyId,
         userId: userId,
         checkInDate: checkIn,
         checkOutDate: checkOut,
         numberOfGuests: adult + child,
      });

      const billing = new Billing({
         ...billingDetails,
         reservationId: reservation._id,
      });
      await billing.save({ session: this.session });
      return reservation.save({ session: this.session });
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

      return await price.calculateTotalPrice(
         checkIn,
         checkOut,
         child,
         adult,
         userId,
         promoCode,
      );
   }

   private createLineItems(billing: BillingProps, propertyDetails: IProperty) {
      const discountedUnitAmount = Math.round(
         (billing.totalbasePrice -
            (billing.discountBreakdown?.lengthDiscount || 0) -
            (billing.discountBreakdown?.promoCodeDiscount || 0)) *
            100,
      );
      return [
         {
            price_data: {
               currency: 'inr',
               product_data: {
                  name: propertyDetails.title,
                  description: `${propertyDetails.details.description}\n\n Number of Guests: ${billing.guest.adult + billing.guest.child}`,
                  images: propertyDetails.gallery.map((x) => x.url).slice(0, 1),
               },
               unit_amount: discountedUnitAmount,
            },
            quantity: 1,
         },
         {
            price_data: {
               currency: 'inr',
               product_data: {
                  name: 'Servicing & Cleaning Fee',
                  description:
                     'Charges for property servicing, maintenance, and cleaning.',
               },
               unit_amount: Math.round(
                  billing.additionalFees?.cleaning * 100 +
                     billing.additionalFees?.service * 100,
               ),
            },
            quantity: 1,
         },
         {
            price_data: {
               currency: 'inr',
               product_data: {
                  name: 'GST Tax',
                  description: 'Applicable Goods and Services Tax (GST)',
               },
               unit_amount: Math.round(billing.additionalFees.tax * 100),
            },
            quantity: 1,
         },
      ];
   }

   private createSessionMetadata(
      user: IUser,
      reservation: any,
      propertyDetails: IProperty,
      userDetails: IUser,
      billing: BillingProps,
   ) {
      return {
         userId: String(user._id),
         reservationId: String(reservation._id),
         guestName: `${userDetails.firstName} ${userDetails.lastName}`,
         checkInDate: String(format(reservation.checkInDate, 'MMMM dd, yyyy')),
         checkOutDate: String(
            format(reservation.checkOutDate, 'MMMM dd, yyyy'),
         ),
         guestCount: reservation.numberOfGuests,
         guestEmail: userDetails.email,
         propertyTitle: propertyDetails.title,
         reservationCode: reservation.reservationCode,
         propertyAddress: propertyDetails.location.address,
         propertyThumbnail: propertyDetails.thumbnail,
         nights: moment(reservation.checkOutDate).diff(
            reservation.checkInDate,
            'days',
         ),

         promoCodeId: String(billing.promoApplied.promoCodeId),
      };
   }

   public async initiatePayment(
      user: IUser,
      reservationId: mongoose.Types.ObjectId,
      clientType: 'Mobile' | undefined,
   ) {
      const successUrl =
         clientType == 'Mobile'
            ? `${process.env.MOBILE_URL}?screen=PropertyBookingDetails&reservationId=${reservationId}`
            : `${process.env.CLIENT_URL}/booking-process/${reservationId}`;
      const cancelUrl =
         clientType == 'Mobile'
            ? `${process.env.MOBILE_URL}?screen=PropertyBookingDetails&reservationId=${reservationId}`
            : `${process.env.CLIENT_URL}/booking-process/${reservationId}`;
      // Find reservation
      const reservation = await this.findReservation(reservationId, user._id);
      if (!reservation) {
         throw new ApiError(404, 'No reservation available.');
      }
      const billing = await Billing.findOne({
         reservationId: reservation._id,
      }).session(this.session);

      const propertyDetails = reservation.propertyId;
      const userDetails = reservation.userId as IUser;

      // apply coupon
      const coupon = await PromoCode.findOne({
         _id: billing.promoApplied.promoCodeId,
      });

      if (coupon) {
         const couponValidity = await coupon.validatePromoCode(
            billing.totalbasePrice,
         );

         if (couponValidity.isValid) {
            const isPromoValidForUser = await checkPromoValidForUser(
               coupon._id,
               user._id,
               coupon.maxPerUser,
            );

            if (isPromoValidForUser.isValid) {
               const promoUsage = new PromoUsage({
                  reservationId: reservation._id,
                  userId: user._id,
                  promoCodeId: billing?.promoApplied?.promoCodeId,
                  appliedOn: new Date(),
               });

               await promoUsage.save({ session: this.session });
               await coupon.incrementUsedCount(this.session);
            }
         }
      }

      const session = await this.stripe.checkout.sessions.create({
         payment_method_types: ['card'],
         mode: 'payment',
         line_items: this.createLineItems(billing, propertyDetails),

         customer_email: userDetails.contactEmail,
         shipping_address_collection: {
            allowed_countries: ['US', 'GB', 'IN', 'AE'],
         },
         billing_address_collection: 'auto',
         expires_at: Math.floor(Date.now() / 1000) + 1860,
         success_url: successUrl,
         cancel_url: cancelUrl,
         metadata: this.createSessionMetadata(
            user,
            reservation,
            propertyDetails,
            userDetails,
            billing,
         ),
         invoice_creation: {
            enabled: true,
         },
      });

      const transaction = new Transaction({
         stripeSessionId: session.id,
         reservationId: reservation._id,
         billingId: billing._id,
         paymentAmount: billing.remainingAmount,
      });

      await transaction.save({ session: this.session });

      return {
         sessionId: session.id,
         reservationId: reservationId,
         url: session.url,
      };
   }

   public async createReservation(
      user: IUser,
      propertyId: mongoose.Types.ObjectId,
      checkIn: Date,
      checkOut: Date,
      adult: number,
      child: number,
      promoCode?: string,
   ) {
      const property = await Property.findOne({ _id: propertyId }).session(
         this.session,
      );

      if (!property) {
         throw new ApiError(400, 'no property available');
      }

      const billingDetails = await this.calculateBillingDetails(
         property,
         checkIn,
         checkOut,
         child,
         adult,
         user.id,
         promoCode,
      );
      return this.createInitialReservation(
         user._id,
         propertyId,
         property.hostId,
         checkIn,
         checkOut,
         adult,
         child,
         billingDetails,
      );
   }
}
