import mongoose, { ClientSession, Model, PipelineStage } from 'mongoose';
import { ApiError } from '../error-handlers/ApiError';

export function validateObjectId(objectId: string | mongoose.Types.ObjectId) {
   if (!mongoose.isValidObjectId(objectId)) {
      throw new ApiError(400, 'Invalid id');
   }
   return new mongoose.Types.ObjectId(objectId);
}

export async function withMongoTransaction<T>(
   callback: (session: ClientSession) => Promise<T>
): Promise<T> {
   const session = await mongoose.startSession();
   try {
      let result: T;
      await session.withTransaction(async () => {
         result = await callback(session);
      });
      return result!;
   } finally {
      await session.endSession();
   }
}

export async function getMongoQueryRunTimePlan<ModelType>(model: Model<ModelType>, pipeline: PipelineStage[]) {
   const stats = await model.db.db.command({
      explain: {
         aggregate: model.collection.name,
         pipeline: pipeline,
         cursor: {}
      },
      verbosity: 'executionStats'
   });
   console.dir(stats.stages, { depth: null });
   return stats
}