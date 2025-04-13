import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPropertyRules extends Document {
   _id: Types.ObjectId;
   housingRules?: string;
   cancellationPolicy?: {
      type: 'flexible' | 'moderate' | 'strict' | 'non-refundable';
      description?: string;
   };
   safetyAndProperty?: string;
   isHaveSelfCheckin?: boolean;
   isHaveInstantBooking?: boolean;
   isPetAllowed: boolean;
   notes?: {
      generalNote?: string;
      nearByAttractionNote?: string;
   };
   checkInTime: string;
   checkOutTime: string;
   safetyConsideration?: {
      category: string;
      details: string;
   }[];
}

const propertyRulesSchema = new Schema<IPropertyRules>({
   housingRules: String,
   cancellationPolicy: {
      type: {
         type: String,
         enum: ['flexible', 'moderate', 'strict', 'non-refundable'],
      },
      description: String,
   },
   safetyAndProperty: String,
   isHaveSelfCheckin: Boolean,
   isHaveInstantBooking: Boolean,
   isPetAllowed: Boolean,
   notes: {
      generalNote: {
         type: String,
         default: '',
      },
      nearByAttractionNote: {
         type: String,
         default: '',
      },
   },
   checkInTime: {
      type: String,
      required: true,
   },
   checkOutTime: {
      type: String,
      required: true,
   },
   safetyConsideration: [
      {
         category: { type: String, required: true },
         details: { type: String, required: true },
      },
   ],
});

const PropertyRules = mongoose.model('PropertyRules', propertyRulesSchema);

export { PropertyRules };
