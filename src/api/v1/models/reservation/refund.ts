import mongoose from 'mongoose';

// Not in use currently


const refundSchema = new mongoose.Schema({
   transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
   },
   refundAmount: { type: Number, required: true },
   refundReason: String,
   refundStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
   },
   refundedAt: { type: Date, default: Date.now },
});

export const Refund = mongoose.model('Refund', refundSchema);
