import mongoose from 'mongoose';
// Not in use currently
const CancellationPolicySchema = new mongoose.Schema({
   type: {
      type: String,
      enum: ['flexible', 'moderate', 'strict', 'non-refundable'],
      required: true,
   },
   refundRules: [
      {
         daysBeforeCheckIn: Number,
         refundPercentage: Number,
      },
   ],
});

export const CancellationPolicy = mongoose.model(
   'CancellationPolicy',
   CancellationPolicySchema,
);
