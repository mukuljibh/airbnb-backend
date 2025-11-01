import { Schema, model } from 'mongoose';
// Not in use currently

const paymentCardSchema = new Schema(
   {
      user_id: {
         type: Schema.Types.ObjectId,
         required: true,
         ref: 'User',
      },

      card_last_four: {
         type: String,
         required: true,
         minlength: 4,
         maxlength: 4,
      },

      card_type: {
         type: String,
         required: true,
         enum: ['visa', 'mastercard', 'amex', 'discover'],
      },

      payment_token: {
         type: String,
         required: true,
      },

      card_holder_name: {
         type: String,
         required: true,
         trim: true,
      },

      expiration_month: {
         type: Number,
         required: true,
         min: 1,
         max: 12,
      },
      expiration_year: {
         type: Number,
         required: true,
      },

      is_default: {
         type: Boolean,
         default: false,
      },
      is_active: {
         type: Boolean,
         default: true,
      },
   },
   {
      timestamps: true,
   },
);

paymentCardSchema.index({ userId: 1 });

paymentCardSchema.methods.maskCardNumber = function () {
   return `****-****-****-${this.cardLastFour}`;
};

export const PaymentCard = model('PaymentCard', paymentCardSchema);
