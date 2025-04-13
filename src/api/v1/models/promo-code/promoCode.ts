import mongoose from 'mongoose';

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
   eligibleUserTypes: ('newUser' | 'existingUser')[];
   maxPerUser: number;
   maxRedemptions: number;
   status: 'active' | 'inactive';
   incrementUsedCount(session: mongoose.mongo.ClientSession): Promise<void>;
   validatePromoCode(
      totalBasePrice: number,
   ): Promise<{ isValid: boolean; message: string }>;
}
const promoCodeSchema = new mongoose.Schema<IPromoCode>(
   {
      promoCode: {
         type: String,
         required: true,
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
) {
   if (totalBasePrice < this.minimumSpend) {
      return {
         isValid: false,
         message: `The minimum spend required to apply this coupon is ${this.minimumSpend}.`,
      };
   }
   return {
      isValid: true,
   };
};

export const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
