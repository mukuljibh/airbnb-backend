import mongoose from 'mongoose';

const eventLogsSchema = new mongoose.Schema({
   eventId: { type: String, unique: true, required: true, index: true },
   lastProcessAttempt: Date,
   processAttempts: { type: Number, default: 0 },
   processedBy: String,
   receivedAt: {
      type: Date,
      default: new Date(),
   },
   completedAt: Date,
   paymentId: String,
   status: {
      type: String,
      enum: ['queued', 'processing', 'complete', 'failed'],
      default: 'queued',
   },
});

eventLogsSchema.index({ eventId: 1, status: 1 })

export const EventLogs = mongoose.model('EventLogs', eventLogsSchema);
