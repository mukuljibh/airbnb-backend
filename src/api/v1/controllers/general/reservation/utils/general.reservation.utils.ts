import Stripe from 'stripe';
import { PromoUsage } from '../../../../models/promo-code/promoUsage';
import mongoose from 'mongoose';
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
         amount_off: Math.round(discountBreakdown.lengthDiscount * 100),
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
) {
   const promoUsedCount = await PromoUsage.countDocuments({
      promoCodeId: promoId,
      userId: userId,
   });

   return {
      isValid: promoUsedCount < userLimit,
      message:
         promoUsedCount < userLimit
            ? undefined
            : `You've reached the usage limit for this promo code. This offer is only valid ${userLimit} times per customer.`,
   };
}
