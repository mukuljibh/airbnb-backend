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
      visibleToRoles: {
         type: [String],
         enum: ['guest', 'host', 'admin'],
      },
      // category: {
      //    type: String,
      //    enum: ['reservation', 'system', 'promo', 'user_query'],
      // },
      // relatedDocId: {
      //    type: mongoose.Types.ObjectId,
      //    refPath: 'typeRef',
      // },
      // relatedModel: {
      //    type: String,
      //    enum: ['property', 'promoCode', 'reservation', 'user'],
      // },
      redirectKey: {
         type: String,
         default: null,
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
