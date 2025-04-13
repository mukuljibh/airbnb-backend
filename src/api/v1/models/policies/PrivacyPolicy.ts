import mongoose from 'mongoose';

const PrivacyPolicySchema = new mongoose.Schema(
   {
      title: {
         type: String,
         required: true,
      },
      type: {
         type: String,
         enum: [
            'privacyPolicy',
            'termsConditions',
            'refundPolicy',
            'bookingCancellationPolicy',
         ],
         required: true,
         unique: true,
      },
      body: {
         type: String,
         required: true,
      },
      isActive: {
         type: Boolean,
         default: true,
      },
   },
   { timestamps: true },
);

// Create model
export const PrivacyPolicy = mongoose.model(
   'PrivacyPolicy',
   PrivacyPolicySchema,
);
