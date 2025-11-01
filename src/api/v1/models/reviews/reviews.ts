import mongoose from 'mongoose';

import { IReviews } from './types/reviews.type';

const reviewsSchema = new mongoose.Schema<IReviews>(
   {
      reservationId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Reservation',
      },
      propertyId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Property',
         required: true,
      },
      userId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true,
      },
      content: {
         type: String,
      },
      rating: {
         type: Number,
         required: true,
         min: 1,
         max: 5,
      },
      reviewedAt: {
         type: Date,
         default: Date.now,
      }

   },
   { timestamps: true },
);
// This is the key part that ensures one review per user per property
reviewsSchema.index({ propertyId: 1, userId: 1, reservationId: 1 }, { unique: true });
reviewsSchema.index({ propertyId: 1 });

const Reviews = mongoose.model('Review', reviewsSchema);

export { Reviews };
