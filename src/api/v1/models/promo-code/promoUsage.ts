import mongoose from 'mongoose';

const promoUsageSchema = new mongoose.Schema(
   {
      userId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Users',
         required: true,
      },
      promoCodeId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'promoCode',
         required: true,
      },
      appliedOn: Date,
      reservationId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Reservation',
         required: true,
      },
   },
   { timestamps: true },
);

export const PromoUsage = mongoose.model('PromoUsage', promoUsageSchema);
