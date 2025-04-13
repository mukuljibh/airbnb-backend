import mongoose from 'mongoose';

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
