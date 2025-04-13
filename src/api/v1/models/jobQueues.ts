import mongoose from 'mongoose';
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
   processingAt: {
      type: Date,
      default: null,
   },
   createdAt: {
      type: Date,
      default: Date.now,
   },
});
export const JobQueues = mongoose.model('JobQueues', jobQueuesSchema);
