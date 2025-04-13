import mongoose from 'mongoose';

export interface BillingProps {
   reservationId: mongoose.Schema.Types.ObjectId;
   numberOfNights: number;
   pricePerNight: number;
   totalbasePrice: number;
   discounts: number;
   priceAfterDiscounts: number;
   additionalFees: { cleaning: number; service: number; tax: number };
   totalPrice: number;
   currency: string;
   selectedDates: {
      checkIn: Date;
      checkOut: Date;
   };
   promoApplied: {
      promoCodeId: mongoose.Types.ObjectId;
      promoCode: string;
      discountType: 'percentage' | 'flat';
      discountValue: number;
   };
   totalAmountPaid: number;
   discountBreakdown: {
      lengthDiscount: number;
      promoCodeDiscount: number;
   };
   totalRefunded: number;
   hasRefunds: boolean;
   remainingAmount: number;
   paymentStatus: 'pending' | 'partial_paid' | 'fully_paid' | 'refunded';
   guest: {
      child: number;
      adult: number;
   };
   billingAddress: {
      name: string;
      email: string;
      country: string;
      city: string;
      state: string;
      line1: string;
      line2: string;
      postCode: string;
   };
}
const billingSchema = new mongoose.Schema<BillingProps>({
   reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
   },
   numberOfNights: Number,
   pricePerNight: Number,
   totalbasePrice: Number,

   discounts: Number,
   priceAfterDiscounts: Number,
   additionalFees: { cleaning: Number, service: Number, tax: Number },
   guest: {
      child: Number,
      adult: Number,
   },
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
   promoApplied: {
      promoCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'promoCode' },
      promoCode: String,
      discountType: {
         type: String,
         enum: ['percentage', 'flat'],
      },
      discountValue: Number,
   },
   //to calculate total amount paid by person equation would be totalAmountPaid - totalRefunded
   totalRefunded: Number,

   hasRefunds: Boolean,
   currency: String,
   billingAddress: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
      country: { type: String },
      city: { type: String },
      state: { type: String },
      line1: { type: String },
      line2: { type: String },
      postalCode: { type: String },
   },
});

// billingSchema.pre('save', async function (next) {
//    if (this.isModified('totalAmountPaid')) {
//       this.remainingAmount =
//          Number(this.remainingAmount) - Number(this.totalAmountPaid);
//       this.paymentStatus =
//          this.remainingAmount > 0 ? 'partial_paid' : 'fully_paid';
//    }
//    next();
// });

export const Billing = mongoose.model('Billing', billingSchema);
