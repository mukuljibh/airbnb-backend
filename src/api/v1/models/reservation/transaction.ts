import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
   {
      billingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Billing' },
      reservationId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Reservation',
      },
      stripeInvoiceId: String,
      stripeTransactionId: String,
      stripeRefundId: String,
      stripeSessionId: String,
      paymentIntentId: String,
      paymentMethod: String,
      receiptUrl: String,
      paymentAmount: {
         type: Number,
      },
      paymentStatus: {
         type: String,
         enum: ['processing', 'paid', 'refunded'],
         default: 'processing',
      },
      referenceTxn: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Transaction',
      },
      type: {
         type: String,
         enum: ['PAYMENT', 'REFUND'],
      },
   },
   { timestamps: true },
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
