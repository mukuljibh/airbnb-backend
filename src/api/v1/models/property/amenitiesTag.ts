import mongoose, { model } from 'mongoose';

const amenitiesTagSchema = new mongoose.Schema({
   title: {
      type: String,
      required: [true, 'title is required'],
   },
   description: {
      type: String,
      required: [true, 'title is required'],
   },
   status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
   },
});

export const AmenitiesTag = model('AmenitiesTag', amenitiesTagSchema);
