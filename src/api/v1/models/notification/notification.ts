import mongoose from 'mongoose';
const notificationSchema = new mongoose.Schema(
   {
      userId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true,
         index: true,
      },

      title: {
         type: String,
         required: true,
      },

      message: {
         type: String,
         required: true,
      },

      type: {
         type: String,
         enum: ['reservation', 'system', 'payment', 'promo', 'review'],
         required: true,
      },

      genericRef: {
         type: mongoose.Types.ObjectId,
         required: true,
         refPath: 'typeRef',
      },
      typeRef: {
         type: String,
         required: true,
         enum: ['property', 'promoCode', 'reservation', 'user'],
      },

      isRead: {
         type: Boolean,
         default: false,
      },
      metadata: {
         type: Object,
         default: {},
      },
   },
   {
      timestamps: true,
   },
);

export const Notification = mongoose.model('Notification', notificationSchema);
