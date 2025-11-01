import mongoose from 'mongoose';

const chatMessagesSchema = new mongoose.Schema({

   roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'room',
      required: true,
   },
   roomQueryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomQuery',
   },
   senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
   },
   messageType: {
      type: String,
      enum: ["plain", "attachment"],
      default: "plain"
   },
   documentType: {
      type: String,
   },
   url: {
      type: String,
      required: function () {
         return this.messageType === 'attachment'
      }
   },
   message: {
      type: String,
      trim: true,
   },
   createdAt: {
      type: Date,
      default: Date.now
   }
},
   { timestamps: true }
);

chatMessagesSchema.index({ senderId: 1, roomId: 1 });
chatMessagesSchema.index({ roomQueryId: 1 });

export const ChatMessages = mongoose.model('chatMessages', chatMessagesSchema);
