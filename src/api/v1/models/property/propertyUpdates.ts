import mongoose, { Schema } from 'mongoose';
import { IPropertyPendingUpdates } from './types/property.model.types';
import { propertyGallerySchema } from './gallery';
import * as propertyAttribute from "./propertyAttributes/propertyAttributes"
import { VERIFICATION_STATUS } from './propertyAttributes/propertyAttributes';


const propertyUpdatesSchema = new mongoose.Schema<IPropertyPendingUpdates>(
   {
      propertyId: {
         type: Schema.Types.ObjectId,
         ref: 'Property',
         required: true,
      },
      userId: {
         type: Schema.Types.ObjectId,
         ref: 'User',
         required: true,
      },

      gallery: {
         type: [propertyGallerySchema],
      },

      location: propertyAttribute.propertyLocationObject,

      documents: [propertyAttribute.propertyVerficationDocumentObject],


      status: {
         type: String,
         enum: Object.values(VERIFICATION_STATUS),
         default: VERIFICATION_STATUS.PENDING
      },


      isUserBannerDismissed: {
         type: Boolean,
         default: false
      },

      changedFields: {
         type: [String],
         enum: ['documents', 'gallery', 'location',]

      },

      rejectedFields: {
         type: [String],
         enum: ['documents', 'gallery', 'location',]

      },

      hostRemark: {
         type: String,
      },

      adminRemark: {
         type: String
      },

      verifiedAt: Date,

      rejectedAt: Date,
      requestAt: {
         type: Date,
         default: Date.now
      },



   },
   { timestamps: true },
);


propertyUpdatesSchema.index({ propertyId: 1, userId: 1 })

propertyUpdatesSchema.index({ propertyId: 1, status: 1 });

propertyUpdatesSchema.index({ userId: 1, status: 1 });

const PropertyUpdateModel = mongoose.model(
   'PropertyUpdates',
   propertyUpdatesSchema,
);

export { PropertyUpdateModel };
