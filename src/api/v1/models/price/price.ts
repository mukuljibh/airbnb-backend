import mongoose, { model } from 'mongoose';
import { IPricing } from './types/price.model.type';
import { zeroDecimalCurrencies } from '../../constant/currency.constant';
import {
   isWeekend,
   calculateNights,
   calculateServiceFees,
   calculatePromoDiscount,
   normalizePrecision,
   normalizeCurrencyPayload,
} from './utils/price.utils';
import moment from 'moment';


const PricingSchema = new mongoose.Schema<IPricing>({
   propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
   },
   basePrice: {
      amount: {
         type: Number,
         required: true,
      },
      currency: {
         type: String,
         required: true,
         default: 'usd',
         lowerCase: true,
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

   dailyRates: [
      {
         price: {
            type: Number,
            required: true,
            min: 0,
         },
         startDate: {
            type: Date,
            required: true,
         },
         endDate: {
            type: Date,
            required: true,
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
         _id: false,
         minNights: Number,
         discount: Number, // Percentage discount

      },
   ],
   // Additional fees
   additionalFees: {
      cleaning: {
         type: Number,
      },
      service: {
         type: Number,
      },
      tax: {
         type: Number,
         // default: 18,
      }, // Percentage
   },
   // Weekend pricing
   weekendMultiplier: {
      type: Number,
      default: 1,
   },
});

PricingSchema.index({ propertyId: 1 })
PricingSchema.index(
   { "dailyRates.startDate": 1, "dailyRates.endDate": 1 }
);

export const Price = model('Price', PricingSchema);
