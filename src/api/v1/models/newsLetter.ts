import mongoose from 'mongoose';
const newsletterSchema = new mongoose.Schema({
   email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      trim: true,
   },
   subscribedAt: {
      type: Date,
      default: Date.now,
   },
   unSubscribedAt: {
      type: Date,
   },
   status: {
      type: String,
      enum: ['subscribed', 'unsubscribed'],
      default: 'subscribed',
   },
});

const Newsletter = mongoose.model('Newsletter', newsletterSchema);
export default Newsletter;
