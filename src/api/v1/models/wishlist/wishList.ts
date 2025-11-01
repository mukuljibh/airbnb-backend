import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
   {
      userId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true,
      },
      propertyId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Property',
         required: true,
      },
   },
   { timestamps: true },
);

wishlistSchema.index({ userId: 1, propertyId: 1 }, { unique: true });
wishlistSchema.index({ userId: 1 });

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export { Wishlist };
