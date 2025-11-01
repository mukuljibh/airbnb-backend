import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

interface currencyExchangeRate {
   baseDiscountValue: number,
   rate: number, // e.g. 1 USD = 82.50 INR
   baseCurrency: string,// e.g. "USD"
   targetCurrency: string, // e.g. "INR"
   source?: string,// optional - e.g. "Fixer.io", "OpenExchangeRates"
   timestamp: Date
};
export interface BillingProps {
   _id: mongoose.Schema.Types.ObjectId;
   reservationId: mongoose.Schema.Types.ObjectId;
   numberOfNights: number;
   pricePerNight: number;
   totalbasePrice: number;
   discounts: number;
   priceAfterDiscounts: number;
   additionalFees: { cleaning: number; service: number; tax: number, platformFees: number };
   totalPrice: number;
   currency: string;
   taxPercentage?: number;
   subTotal: number;
   selectedDates: {
      checkIn: Date;
      checkOut: Date;
   };
   promoApplied: {
      promoCodeId: mongoose.Types.ObjectId;
      promoCode: string;
      discountType: 'percentage' | 'flat';
      discountValue: number;
      currencyExchangeRate: currencyExchangeRate;
   };
   totalAmountPaid: number;
   lengthDiscountPercentage: number;
   discountBreakdown: {
      lengthDiscount: number;
      promoCodeDiscount: number;
   };
   currencyExchangeRate: currencyExchangeRate
   totalRefunded: number;
   hasRefunds: boolean;
   remainingAmount: number;
   // paymentStatus: 'pending' | 'partial_paid' | 'fully_paid' | 'refunded';
   guest: {
      child: number;
      adult: number;
   };
   guestDetails: {
      name: string;
      phone: string;
      email: string;
   };
   billingDetails: {
      name: string;
      email: string;
      phone: string;
      address: {
         city: string;
         country: string;
         line1: string;
         line2: string;
         postal_code: string;
         state: string;
      };
   };
   billingCode: string;
}
const billingSchema = new mongoose.Schema<BillingProps>(
   {
      billingCode: String,
      reservationId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Reservation',
      },
      guest: {
         child: Number,
         adult: Number,
      },
      numberOfNights: Number,
      pricePerNight: Number,
      totalbasePrice: Number,
      discounts: Number,
      priceAfterDiscounts: Number,
      taxPercentage: { type: Number, min: 0, max: 100 },
      additionalFees: { cleaning: Number, service: Number, tax: Number, platformFees: Number },
      subTotal: Number,
      totalPrice: Number,
      totalAmountPaid: {
         type: Number,
         default: 0,
      },
      remainingAmount: {
         type: Number,
         default: function () {
            return this.totalPrice;
         },
      },
      discountBreakdown: Object,
      lengthDiscountPercentage: Number,
      promoApplied: {
         promoCodeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'promoCode',
         },
         promoCode: String,
         discountType: {
            type: String,
            enum: ['percentage', 'flat'],
         },
         baseDiscountValue: Number,
         discountValue: Number,
         currencyExchangeRate: {
            rate: Number,
            baseCurrency: {
               type: String,
               lowerCase: true,
            },
            targetCurrency: {
               type: String,
               lowerCase: true,
            },
            // source: String,
            timestamp: {
               type: Date,
            }
         },
      },
      //to calculate total amount paid by person equation would be totalAmountPaid - totalRefunded
      totalRefunded: Number,
      hasRefunds: Boolean,
      currency: {
         type: String,
         lowercase: true,

      },
      currencyExchangeRate: {
         rate: Number,
         baseCurrency: {
            type: String,
            lowerCase: true,
         },
         targetCurrency: {
            type: String,
            lowerCase: true,
         },
         // source: String,
         timestamp: {
            type: Date,
            default: new Date()
         }
      },
      guestDetails: {
         name: String,
         phone: String,
         email: String,
      },
      billingDetails: Object,
   },
   { timestamps: true },
);

// billingSchema.pre('save', async function (next) {
//    if (this.isModified('totalAmountPaid')) {
//       this.remainingAmount =
//          Number(this.remainingAmount) - Number(this.totalAmountPaid);
//       this.paymentStatus =
//          this.remainingAmount > 0 ? 'partial_paid' : 'fully_paid';
//    }
//    next();
// });

billingSchema.pre('save', function (next) {
   if (!this.billingCode) {
      this.billingCode = `INV-${uuidv4().split('-')[0].toUpperCase()}`;
   }
   next();
});
export const Billing = mongoose.model('Billing', billingSchema);
