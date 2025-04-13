import mongoose from 'mongoose';
import { ApiError } from '../error-handlers/ApiError';

export function validateObjectId(objectId: string | mongoose.Types.ObjectId) {
   if (!mongoose.isValidObjectId(objectId)) {
      throw new ApiError(400, 'Invalid id');
   }
   return new mongoose.Types.ObjectId(objectId);
}
