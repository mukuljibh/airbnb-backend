import mongoose, { model } from 'mongoose';

const propertyAddressSchema = new mongoose.Schema({
   location: {
      regionId: String,
      address: String,
      city: String,
      zipCode: String,
      country: String,
      state: String,
      landmark: String,
      coordinates: {
         latitude: Number,
         longitude: Number,
      },
   },
   verification: [
      {
         documentType: { type: String },
         documentUrl: String,
         status: {
            type: String,
            enum: [
               'open',
               'pending',
               'verified',
               'rejected',
               'required_action',
            ],
            default: 'open',
         },
         reason: String,
      },
   ],
});

export const propertyAddress = model('AmenitiesTag', propertyAddressSchema);
