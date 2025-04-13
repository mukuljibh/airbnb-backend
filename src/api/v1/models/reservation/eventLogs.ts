import mongoose from 'mongoose';

const eventLogsSchema = new mongoose.Schema({
   eventId: { type: String, unique: true, required: true },
   lastProcessAttempt: Date,
   processAttempts: { type: Number, default: 0 },
   receivedAt: {
      type: Date,
      default: new Date(),
   },
   completedAt: Date,
   paymentId: String,
   status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
   },
});

export const EventLogs = mongoose.model('EventLogs', eventLogsSchema);
