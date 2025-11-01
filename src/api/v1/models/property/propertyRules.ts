import mongoose, { Schema, Document, Types } from 'mongoose';
import { IPropertyRules } from './types/property.model.types';

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
