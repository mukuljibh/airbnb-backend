import mongoose, { Schema, Document } from 'mongoose';

export interface IPropertyPendingUpdates extends Document {
   propertyId: mongoose.Types.ObjectId;
   gallery?: {
      url: string;
      caption?: string;
      isPrimary?: boolean;
   }[];
   location?: {
      regionId?: string;
      address?: string;
      city?: string;
      zipCode?: string;
      country?: string;
      state?: string;
      landmark?: string;
      coordinates?: {
         latitude: number;
         longitude: number;
      };
   };
   verification?: {
      status: 'open' | 'pending' | 'verified' | 'rejected' | 'required_action';
      reason?: string;
      documents?: {
         documentType:
            | 'rental agreement'
            | 'land registry document'
            | 'electricity bill'
            | 'water bill'
            | 'property tax receipt'
            | 'property deed'
            | 'gas bill';
         documentUrl: string;
      }[];
   };
}

const propertyPendingUpdatesSchema =
   new mongoose.Schema<IPropertyPendingUpdates>(
      {
         propertyId: {
            type: Schema.Types.ObjectId,
            ref: 'Property',
            required: true,
         },
         // Unverified Gallery Updates
         gallery: [
            {
               url: String,
               caption: String,
               isPrimary: Boolean,
            },
         ],

         // Unverified Location Updates
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

         // Unverified Verification Documents
         verification: {
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
            reason: { type: String },
            documents: [
               {
                  documentType: {
                     type: String,
                     required: true,
                     enum: [
                        'rental agreement',
                        'land registry document',
                        'electricity bill',
                        'water bill',
                        'property tax receipt',
                        'property deed',
                        'gas bill',
                     ],
                  },
                  documentUrl: {
                     type: String,
                     required: true,
                  },
               },
            ],
         },
      },
      { timestamps: true },
   );

const PropertyPendingUpdates = mongoose.model(
   'PropertyPendingUpdates',
   propertyPendingUpdatesSchema,
);

export { PropertyPendingUpdates };
