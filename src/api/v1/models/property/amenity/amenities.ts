import mongoose, { model } from 'mongoose';

const amenitiesSchema = new mongoose.Schema({
   title: {
      type: String,
      required: [true, 'title is required'],
   },

   tag: {
      type: mongoose.Types.ObjectId,
      ref: 'amenitiesTag',
   },
   icon: {
      type: String,
      required: [true, 'icon is required to explain'],
   },
});
amenitiesSchema.index({ tag: 1 })

export const Amenities = model('Amenities', amenitiesSchema);
