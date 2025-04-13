import { checkPromoValidForUser } from '../../../controllers/general/reservation/utils/general.reservation.utils';
import { PromoCode } from '../../promo-code/promoCode';

export function calculateFee(rule, personCount, basePrice) {
   if (personCount <= rule.limit) {
      return 0;
   }
   const headCount = personCount - rule.limit;
   switch (rule.type) {
      case 'fixed':
         return rule.value;
      case 'percentage':
         return (basePrice * rule.value) / 100;
      case 'per_person':
         return headCount * rule.value;
      default:
         return 0;
   }
}

export function calculateServiceFees(
   rules,
   childCount,
   adultCount,
   baseServiceFees,
) {
   let fees = 0;
   fees += calculateFee(rules.adult, adultCount, baseServiceFees);
   fees += calculateFee(rules.child, childCount, baseServiceFees);
   const total = baseServiceFees + fees;
   return Number(total.toFixed(2));
}

export function isWeekend(date: Date) {
   const day = date.getDay();
   return day === 6 || day == 0;
}

export function calculateNights(checkIn: Date, checkOut: Date) {
   const checkInTime = checkIn.getTime();
   const checkOutTime = checkOut.getTime();
   return Math.ceil((checkOutTime - checkInTime) / (1000 * 60 * 60 * 24));
}
export async function calculatePromoDiscount(
   userId: string,
   basePrice: number,
   discounts: {
      totalDiscount: number;
      discountBreakdown: {
         lengthDiscount: number;
         promoCodeDiscount: number;
      };
   },
   promoCode: string,
) {
   const code = await PromoCode.findOne({ promoCode: promoCode.toUpperCase() });
   let { totalDiscount } = discounts;
   const { discountBreakdown } = discounts;

   if (code) {
      const couponValidity = await code.validatePromoCode(basePrice);

      if (couponValidity.isValid) {
         // Ensure promo code is valid before proceeding
         const { discountType, discountValue } = code;
         const isPromoValidForUser = await checkPromoValidForUser(
            code._id,
            userId,
            code.maxPerUser,
         );

         if (isPromoValidForUser.isValid) {
            let promoCodeDiscount = 0;
            switch (discountType) {
               case 'percentage': {
                  promoCodeDiscount = (basePrice * discountValue) / 100;
                  break;
               }
               case 'flat': {
                  promoCodeDiscount = discountValue;
                  break;
               }
            }

            // Add promo code discount separately
            promoCodeDiscount = Number(promoCodeDiscount.toFixed(2));
            totalDiscount = Number(
               (totalDiscount + promoCodeDiscount).toFixed(2),
            );
            discountBreakdown.promoCodeDiscount = promoCodeDiscount;
         }
      }
   }

   return {
      totalDiscount,
      discountBreakdown,
      promoApplied: code
         ? {
              promoCodeId: code._id,
              promoCode: code.promoCode,
              discountType: code.discountType,
              discountValue: code.discountValue,
           }
         : null, // If no valid promo, return null
   };
}
