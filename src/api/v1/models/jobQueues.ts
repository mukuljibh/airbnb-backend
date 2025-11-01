import mongoose from 'mongoose';

// Obsolete: Previously used, not in use anymore.

const jobQueuesSchema = new mongoose.Schema({
   payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
   },
   status: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
   },
   retries: {
      type: Number,
      default: 0,
   },
   lockedAt: {
      type: Date,
      default: null,
   },
   createdAt: {
      type: Date,
      default: Date.now,
   },
});
jobQueuesSchema.index({ status: 1, lockedAt: 1 });

export const JobQueues = mongoose.model('JobQueues', jobQueuesSchema);
