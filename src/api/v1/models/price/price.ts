import mongoose, { model } from 'mongoose';
import { IPricing } from './types/price.model.type';
import {
   isWeekend,
   calculateNights,
   calculateServiceFees,
   calculatePromoDiscount,
} from './utils/price.utils';

const PricingSchema = new mongoose.Schema<IPricing>({
   basePrice: {
      amount: {
         type: Number,
         required: true,
         default: 0,
      },
      currency: {
         type: String,
         required: true,
         enum: ['INR', 'USD', 'GBP', 'EUR'],
         default: 'INR',
      },
   },
   capacityFeesRules: {
      adult: {
         type: {
            type: String,
            enum: ['fixed', 'percentage', 'per_person'],
            default: 'fixed',
         },
         limit: {
            type: Number,
            default: 0,
         },
         value: {
            type: Number,
            min: 0,
            default: 0,
         },
      },
      child: {
         type: {
            type: String,
            enum: ['fixed', 'percentage', 'per_person'],
            default: 'fixed',
         },
         limit: {
            type: Number,
            default: 0,
         },
         value: {
            type: Number,
            min: 0,
            default: 0,
         },
      },
   },
   seasonalRates: [
      {
         name: {
            type: String,
            // required: true // e.g., "Summer", "Winter", "Peak", "Off-peak"
         },
         startDate: Date,
         endDate: Date,
         multiplier: {
            type: Number,
            default: 1,
         },
      },
   ],
   specialDates: [
      {
         date: Date,
         multiplier: Number,
         description: String,
      },
   ],
   lengthDiscounts: [
      {
         minNights: Number,
         discount: Number, // Percentage discount
      },
   ],
   // Additional fees
   additionalFees: {
      cleaning: {
         type: Number,
         default: 0,
      },
      service: {
         type: Number,
         default: 5,
      },
      tax: {
         type: Number,
         default: 18,
      }, // Percentage
   },
   // Weekend pricing
   weekendMultiplier: {
      type: Number,
      default: 1,
   },
});

PricingSchema.methods.calculateBasePrice = function (
   checkIn: Date,
   checkOut: Date,
) {
   let totalBase = 0;
   const currentDate = new Date(checkIn);
   while (currentDate < checkOut) {
      let dailyRate = this.basePrice.amount;
      // Apply weekend multiplier
      if (isWeekend(currentDate)) {
         dailyRate *= this?.weekendMultiplier;
      }
      // Checking here for seasonal rates
      this?.seasonalRates.forEach((season) => {
         if (currentDate >= season.startDate && currentDate <= season.endDate) {
            console.log(season);
            dailyRate *= season.multiplier;
         }
      });
      //added 1.2x or more as per entry each special day
      if (this.specialDates) {
         this.specialDates.forEach((special) => {
            if (currentDate.toDateString() === special.date.toDateString()) {
               console.log('special date');

               dailyRate *= special.multiplier;
            }
         });
      }
      totalBase += dailyRate;
      currentDate.setDate(currentDate.getDate() + 1);
   }
   return totalBase;
};

PricingSchema.methods.calculateDiscount = function (
   basePrice: number,
   numberOfNights: number,
): { totalDiscount: number; discountBreakdown: Record<string, number> } {
   let totalDiscount = 0;
   const discountBreakdown: Record<string, number> = {};

   // Length of stay discount
   // give best discount
   const applicableLengthDiscount = this.lengthDiscounts
      .filter((discount) => numberOfNights >= discount.minNights)
      .sort((a, b) => b.discount - a.discount)[0];

   if (applicableLengthDiscount) {
      const lengthDiscountAmount = Number(
         ((basePrice * applicableLengthDiscount.discount) / 100).toFixed(2),
      );
      totalDiscount += lengthDiscountAmount;
      if (lengthDiscountAmount > 0)
         discountBreakdown.lengthDiscount = lengthDiscountAmount;
   }

   return {
      totalDiscount: Number(totalDiscount.toFixed(2)),
      discountBreakdown,
   };
};

PricingSchema.methods.calculateTotalPrice = async function (
   checkIn: Date,
   checkOut: Date,
   childCount: number,
   adultcount: number,
   userId?: string,
   promoCode?: string,
) {
   const numberOfNights = calculateNights(checkIn, checkOut);
   const totalbasePrice = this.calculateBasePrice(checkIn, checkOut);
   let discounts = this.calculateDiscount(totalbasePrice, numberOfNights);
   if (promoCode && userId) {
      discounts = await calculatePromoDiscount(
         userId,
         totalbasePrice,
         discounts,
         promoCode,
      );
   }
   const priceAfterDiscounts = totalbasePrice - discounts?.totalDiscount || 0;
   const cleaningFee = this.additionalFees.cleaning;
   const serviceFee = calculateServiceFees(
      this.capacityFeesRules,
      childCount,
      adultcount,
      this.additionalFees.service,
   );
   const taxAmount = Number(
      (priceAfterDiscounts * (this.additionalFees.tax / 100)).toFixed(2),
   );
   return {
      selectedDates: {
         checkIn: checkIn,
         checkout: checkOut,
      },
      guest: {
         child: childCount,
         adult: adultcount,
      },
      numberOfNights,
      pricePerNight: this.basePrice.amount,
      totalbasePrice,
      discounts: discounts?.totalDiscount,
      discountBreakdown: discounts?.discountBreakdown,
      promoApplied: discounts?.promoApplied,
      priceAfterDiscounts,
      additionalFees: {
         cleaning: cleaningFee,
         service: serviceFee,
         tax: taxAmount,
      },
      totalPrice: priceAfterDiscounts + cleaningFee + serviceFee + taxAmount,
      currency: this.basePrice.currency,
   };
};

export const Price = model('Price', PricingSchema);
