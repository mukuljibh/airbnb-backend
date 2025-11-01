import mongoose from 'mongoose';

const userQuerySchema = new mongoose.Schema({
   name: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
   },
   email: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
      trim: true,
   },
   subject: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
   },
   query: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
   },
   status: {
      type: String,
      enum: ['open', 'responded', 'closed'],
      default: 'open',
   },
});

const UserQuery = mongoose.model('UserQuery', userQuerySchema);
export default UserQuery;
