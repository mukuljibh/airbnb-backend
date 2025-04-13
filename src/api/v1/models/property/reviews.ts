import mongoose from 'mongoose';

export type IReviews = {
   propertyId: mongoose.Schema.Types.ObjectId;
   userId: mongoose.Schema.Types.ObjectId;
   content: string;
   rating: number;
};
const reviewsSchema = new mongoose.Schema<IReviews>(
   {
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
   },
   { timestamps: true },
);
// This is the key part that ensures one review per user per property
reviewsSchema.index({ propertyId: 1, userId: 1 }, { unique: true });
reviewsSchema.index({ propertyId: 1 });

const Reviews = mongoose.model('Review', reviewsSchema);

export { Reviews };
