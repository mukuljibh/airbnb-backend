import mongoose, { Schema } from 'mongoose';
import { IProperty } from './types/property.model.types';
import { getSinglePropertyAvgReviews } from '../../utils/aggregation-pipelines/agregation.utils';
import { checkAvailableDate } from '../../controllers/general/properties/utils/general.property.utils';

const propertySchema = new mongoose.Schema<IProperty>(
   {
      hostId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
      },
      category: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Category',
      },
      title: String,
      avgRating: { type: Number, default: 0 },
      propertyPlaceType: {
         type: String,
         required: true,
         enum: ['room', 'entire-home'],
      },
      price: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Price',
      },
      propertyRules: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'PropertyRules',
      },
      propertyType: {
         type: String,
         required: true,
         enum: [
            'flat',
            'villa',
            'house',
            'hotel',
            'guest house',
            'resort',
            'apartment',
            'condo',
            'townhouse',
         ],
      },
      thumbnail: String,
      gallery: [
         {
            _id: false,
            url: String,
            caption: String,
            isPrimary: Boolean,
         },
      ],

      capacity: {
         maxGuest: {
            type: Number,
            min: 1,
            max: 50,
         },
         adult: {
            type: Number,
            default: 1,
            min: 1,
            max: 5,
         },
         child: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
         },
      },
      draftStage: {
         type: Number,
         enum: [1, 2, 3, 4, 5, 6],
      },
      visibility: {
         type: String,
         enum: ['draft', 'published'],
         default: 'draft',
      },
      availabilityWindow: Number,
      details: {
         description: { type: String },
         beds: { type: Number },
         bedRooms: {
            type: Number,
            min: 0,
            max: 50,
         },
         bathRooms: {
            type: Number,
            min: 0,
            max: 50,
         },
      },
      tags: [
         {
            type: String,
            enum: ['superhost', 'popular', 'featured', 'new'],
         },
      ],
      experienceTags: {
         type: [String],
         enum: ['beach', 'culture', 'ski', 'family', 'wellnessAndRelaxation'],
      },
      status: {
         type: String,
         enum: ['active', 'inactive'],
         default: 'inactive',
      },
      isBookable: {
         type: Boolean,
         default: false,
      },
      amenities: {
         type: [Schema.Types.ObjectId],
         ref: 'Amenities',
         default: [],
      },

      totalLikes: { type: Number, default: 0 },
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
               _id: false,
               documentType: {
                  type: String,
                  required: true,
                  enum: [
                     'government-issued ID',
                     'rental agreement',
                     'land registry document',
                     'electricity bill',
                     'water bill',
                     'property tax receipt',
                     'property deed',
                     'gas bill',
                     'No Objection Certificate',
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

propertySchema.index({
   name: 'text',
   title: 'text',
   'location.city': 'text',
   'location.address': 'text',
   'location.country': 'text',
   'location.state': 'text',
});

propertySchema.pre('save', async function (next) {
   const gallery = this.gallery;
   const thumbnail = gallery?.filter((x) => x.isPrimary == true)[0];
   this.thumbnail = thumbnail?.url ? thumbnail.url : gallery[0]?.url;
   next();
});
propertySchema.methods.updateAvgRating = async function () {
   const accResult = await getSinglePropertyAvgReviews(this._id);
   if (accResult.length > 0) {
      this.avgRating = accResult[0].averageRating;
      await this.save();
   }
};

propertySchema.methods.checkAvailableDate = async function (
   checkIn: Date,
   checkOut: Date,
) {
   return await checkAvailableDate(checkIn, checkOut, this._id);
};

const Property = mongoose.model('Property', propertySchema);

export { Property };
