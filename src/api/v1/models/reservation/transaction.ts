import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
export interface ITransaction extends Document {
   _id: mongoose.Types.ObjectId;
   transactionCode: string;
   billingId?: mongoose.Types.ObjectId;
   reservationId?: mongoose.Types.ObjectId;
   stripeTransactionId?: string;
   stripeRefundId?: string;
   stripeSessionId?: string;
   paymentIntentId?: string;
   paymentMethod: {
      id: string;
      last4: string;
      brand: string;
      expMonth: number;
      expYear: number;
   };
   currency: string
   receiptUrl?: string;
   paymentAmount?: number;
   paymentStatus?: 'processing' | 'paid' | 'refunded' | 'open';
   referenceTxn?: mongoose.Types.ObjectId;
   type?: 'PAYMENT' | 'REFUND';
   createdAt?: Date;
   updatedAt?: Date;
}
const transactionSchema = new mongoose.Schema<ITransaction>(
   {
      transactionCode: String,
      billingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Billing' },
      reservationId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Reservation',
      },
      stripeTransactionId: String,
      stripeRefundId: String,
      stripeSessionId: String,
      paymentIntentId: String,
      paymentMethod: {
         id: String,
         last4: String,
         brand: String,
         expMonth: Number,
         expYear: Number,
      },
      receiptUrl: String,
      paymentAmount: {
         type: Number,
      },
      paymentStatus: {
         type: String,
         enum: ['open', 'processing', 'paid', 'failed', 'refunded'],
         default: 'open',
      },
      currency: {
         type: String
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

transactionSchema.pre('save', function (next) {
   const type = this.type;
   const prefix = type === 'PAYMENT' ? 'TS' : 'RF';
   if (!this.transactionCode) {
      const uuid = uuidv4().split('-')[0].toUpperCase();
      this.transactionCode = `${prefix}-${uuid}`;
   }

   next();
});
transactionSchema.index({ type: 1, paymentStatus: 1, createdAt: -1 })

transactionSchema.index({ billingId: 1 })

export const Transaction = mongoose.model('Transaction', transactionSchema);
