import mongoose from 'mongoose';
import { model } from 'mongoose';

const BankDetailsSchema = new mongoose.Schema({
   userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
   },
   stripeConnectId: { type: String, unique: true },
   bankName: { type: String },
   last4: { type: String },
   currency: { type: String },
   country: { type: String },
   routingNumber: { type: String },
   accountHolderName: { type: String },
   status: String,
   reason: String,
   details: {
      urgent: [String],
      eventual: [String],
   },
});

export const BankDetails = model('BankDetails', BankDetailsSchema);
