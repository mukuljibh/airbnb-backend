import mongoose from 'mongoose';

const chatAudienceSchema = new mongoose.Schema({
   roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'room',
      required: true,
   },
   userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
   },
   role: {
      type: String,
      enum: ['guest', 'admin', 'host'],
      default: 'guest',
   },
   lastSeenAt: {
      type: Date,
      default: new Date()
   }
}, { timestamps: true });

// chatAudienceSchema.index({ senderId: 1, roomId: 1 });
chatAudienceSchema.index({ roomId: 1, userId: 1 });
chatAudienceSchema.index({ userId: 1 });


export const chatAudience = mongoose.model('chatAudience', chatAudienceSchema);
