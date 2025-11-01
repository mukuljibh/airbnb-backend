import mongoose, { Document, Schema } from 'mongoose';
import { IProperty } from '../../property/types/property.model.types';

// Obsolete: Previously used, not in use anymore.

export type ICheckPoint = {
   checkpointNumber: number;
   data: {
      name: string;
      [key: string]: string;
   };
   savedAt: Date;
};
export type CheckpointType =
   | 'checkpoint1'
   | 'checkpoint2'
   | 'checkpoint3'
   | 'checkpoint4'
   | 'checkpoint5';

export interface IDraft extends Document {
   user_id: Schema.Types.ObjectId;
   property_id: mongoose.Types.ObjectId | IProperty;
   is_draft: boolean;
   check_points: ICheckPoint[];
   draft_stage: CheckpointType[];
   is_ready: boolean;
   is_published: boolean;
   is_property_active: boolean;
   expires_at: Date;
   createdAt: Date;
   updatedAt: Date;
}

const DraftSchema = new Schema<IDraft>(
   {
      user_id: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true,
      },
      property_id: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Property',
      },
      is_draft: { type: Boolean, default: true },
      check_points: [Object],
      draft_stage: {
         type: [String],
         enum: [
            'checkpoint1',
            'checkpoint2',
            'checkpoint3',
            'checkpoint4',
            'checkpoint5',
         ],
      },
      is_ready: { type: Boolean, default: false },
      is_published: Boolean,
      expires_at: {
         type: Date,
         default: null,
      },
   },
   { timestamps: true },
);

DraftSchema.pre('save', async function (next) {
   if (this.isModified('is_published')) {
      this.expires_at = new Date(Date.now());
   }
   next();
});

DraftSchema.index({ expires_at: 1 }, { expireAfterSeconds: 7000 });
const Draft = mongoose.model('Draft', DraftSchema);

export { Draft };
