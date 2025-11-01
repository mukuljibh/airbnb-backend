import mongoose from 'mongoose';
import { getCurrencyWiseRate } from '../price/utils/price.utils';

interface IPromoCode extends Document {
   _id: mongoose.Types.ObjectId;
   promoCode: string;
   description?: string;
   discountType: 'percentage' | 'flat';
   discountValue: number;
   validFrom: Date;
   validUntil: Date;
   usedCount: number;
   minimumSpend: number;
   maximumDiscount: number;
   eligibleUserTypes: ('newUser' | 'existingUser')[];
   uptoPrice: number;
   maxPerUser: number;
   maxRedemptions: number;
   status: 'active' | 'inactive';
   currency: string,

   incrementUsedCount(session: mongoose.mongo.ClientSession): Promise<void>;
   validatePromoCode(
      totalBasePrice: number,
      currency: string
   ): Promise<{ isValid: boolean; message: string }>;
}
const promoCodeSchema = new mongoose.Schema<IPromoCode>(
   {
      promoCode: {
         type: String,
         required: true,
         index: true,
         uppercase: true,
         unique: true,
         trim: true,
      },
      description: {
         type: String,
         required: false,
      },
      discountType: {
         type: String,
         enum: ['percentage', 'flat'],
         required: true,
      },
      discountValue: {
         type: Number,
         required: true,
      },
      maximumDiscount: {
         type: Number
      },
      maxPerUser: {
         type: Number,
         default: 1,
      },
      validFrom: {
         type: Date,
         required: true,
         default: Date.now,
      },
      validUntil: {
         type: Date,
         required: true,
      },
      usedCount: {
         type: Number,
         default: 0,
      },
      minimumSpend: {
         type: Number,
         default: 0,
      },
      eligibleUserTypes: {
         type: [String],
         enum: ['newUser', 'existingUser'],
         default: ['newUser'],
      },
      maxRedemptions: {
         type: Number,
         default: 10,
      },
      currency: {
         type: String,
         default: "USD"
      },

      status: {
         type: String,
         enum: ['active', 'inactive'],
         default: 'inactive',
      },
   },

   { timestamps: true },
);

promoCodeSchema.methods.incrementUsedCount = async function (
   session?: mongoose.mongo.ClientSession,
) {
   this.usedCount = (this.usedCount || 0) + 1;
   await this.save(session ? { session } : {});
};

promoCodeSchema.methods.validatePromoCode = async function (
   totalBasePrice: number,
   currency: string
) {
   const { rate } = await getCurrencyWiseRate(currency)
   const minimumSpend = parseFloat((this.minimumSpend * rate).toFixed(2))
   if (totalBasePrice < minimumSpend) {
      return {
         isValid: false,
         message: `The minimum spend required to apply this coupon is ${currency} ${minimumSpend}.`,
      };
   }
   return {
      isValid: true,
   };
};

export const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
