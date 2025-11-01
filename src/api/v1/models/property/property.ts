import mongoose, { Schema } from 'mongoose';
import { IProperty } from './types/property.model.types';
import { getSinglePropertyAvgReviews } from '../../utils/aggregation-pipelines/agregation.utils';
import moment from 'moment';
import { Reservation } from '../reservation/reservation';
import { ApiError } from '../../utils/error-handlers/ApiError';
import { propertyGallerySchema } from './gallery';
import * as propertyAttribute from "./propertyAttributes/propertyAttributes"


const statusMetaSchema = new Schema({
   previousStatus: {
      type: String,
      enum: Object.values(propertyAttribute.PROPERTY_STATUS),
      required: true
   },
   newStatus: {
      type: String,
      enum: Object.values(propertyAttribute.PROPERTY_STATUS),
      required: true
   },
   changedBy: {
      userId: mongoose.Schema.ObjectId,
      role: {
         type: String,
         enum: ['admin', 'user', 'system']
      }
   },
   timestamp: { type: Date, default: Date.now },
   reason: String
})
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
      title: {
         type: String,
         trim: true,
      },
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
      thumbnail: {
         type: String,
         trim: true,
      },
      gallery: [propertyGallerySchema],

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
      statusMeta: [statusMetaSchema],
      inactivatedBy: {
         userId: mongoose.Types.ObjectId,
         role: {
            type: String,
            enum: ["admin", "host"]
         },
         reason: String,
         timestamp: Date

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
         enum: Object.values(propertyAttribute.PROPERTY_STATUS),
         default: propertyAttribute.PROPERTY_STATUS.INACTIVE,
      },
      isBookable: {
         type: Boolean,
         default: false,
      },
      amenities: {
         type: [Schema.Types.ObjectId],
         ref: 'Amenities',
      },
      hasPendingSensitiveUpdates: {
         type: Boolean,
         default: null
      },
      // totalLikes: { type: Number, default: 0 },

      location: propertyAttribute.propertyLocationObject,

      verification: propertyAttribute.propertyVerificationObject,

      deletionRequestedAt: Date,

      deletedAt: Date
   },
   { timestamps: true },
);



propertySchema.index({
   title: 'text',
   'location.city': 'text',
   'location.address': 'text',
   'location.country': 'text',
   'location.state': 'text',
});

propertySchema.pre('save', async function (next) {
   const gallery = this.gallery;
   const thumbnail = gallery?.find(x => x.isPrimary) || gallery[0];
   this.thumbnail = thumbnail?.url;

   const coordinates = this.location?.coordinates;

   // const testProperty = await Property.findById(this?._id).select('location')

   // const location = testProperty?.location?.coordinates

   if (coordinates) {
      this.location.locationGeo = {
         type: 'Point',
         coordinates: [coordinates.longitude || 0, coordinates.latitude || 0],

      };
   }

   next();
});


propertySchema.methods.updateAvgRating = async function () {
   const accResult = await getSinglePropertyAvgReviews(this._id);
   if (accResult.length > 0) {
      this.avgRating = accResult[0].averageRating;
      await this.save();
   }
};

propertySchema.methods.markPropertyAsDeleted = async function ({ session }) {

   const propertyInstance = this as IProperty

   // propertyInstance.isSoftDeleted = true
   propertyInstance.isBookable = false
   propertyInstance.status = 'inactive'

   await propertyInstance.save({ session })

};


propertySchema.methods.modifyStatus = async function (
   status: 'active' | 'inactive',
   currentUserRole: 'host' | 'admin',
   userId: mongoose.Types.ObjectId,
   reason: string,
) {
   try {

      let response = {
         hasOperationSuccess: false,
         status,
      }

      const todayDate = moment.utc(new Date()).startOf('date').toDate();

      const property = this as IProperty

      const personWhoInactiveProperty = property.inactivatedBy?.role

      if (personWhoInactiveProperty === "admin" && currentUserRole !== "admin") {

         throw new ApiError(403, "This property has been deactivated by the admin. Please contact support for more information.");
      }

      if (status == 'inactive') {

         const anyReservation = await Reservation.findOne({
            propertyId: property._id,
            checkOutDate: { $gte: todayDate },
            status: { $ne: 'cancelled' },
         })
            .sort({ checkInDate: -1 })
            .select('_id checkInDate checkOutDate')

         // property.inactivatedBy = {
         //    userId,
         //    role: currentUserRole,
         //    timestamp: todayDate,
         //    reason
         // }

         property.isBookable = false;

         if (!anyReservation) {
            property.status = "inactive";
            response.hasOperationSuccess = true
         }

      }

      if (status == "active") {

         property.inactivatedBy = undefined;
         property.status = status;
         response.hasOperationSuccess = true
         // response.message = `Property status updated to ${status} successfully.`
      }


      await property.save();

      return response

   } catch (error) {
      console.error('Error modifying status:', error);
      throw error;
   }
};

propertySchema.methods.checkAvailableDate = async function (
   checkIn: Date,
   checkOut: Date,
) {
   const todayDate = moment.utc().startOf('day').toDate();

   // Parse and normalize check-in/check-out dates to UTC 00:00
   const startDate = moment.utc(checkIn).startOf('day');
   const endDate = moment.utc(checkOut).startOf('day');

   // Calculate available end date (today + property availabilityWindow months)
   const availableEnd = moment
      .utc(todayDate)
      .startOf('day')
      .add(this.availabilityWindow, 'months');

   //maintain the rolling window boundary
   if (startDate.isBefore(todayDate) || endDate.isAfter(availableEnd)) {
      return false;
   }

   // Check if the requested dates fit within any available range
   const reservation = await Reservation.aggregate([
      {
         $match: {
            propertyId: this._id,
            status: { $ne: "cancelled" },
            $expr: {
               $and: [
                  { $lt: [{ $toDate: checkIn }, '$checkOutDate'] },
                  { $gt: [{ $toDate: checkOut }, '$checkInDate'] },
               ],
            },
         },
      },
   ]);
   return reservation.length === 0;
};

propertySchema.index({ price: 1 })
propertySchema.index({ propertyRules: 1 })
propertySchema.index({ hostId: 1 })
propertySchema.index({ amenities: 1 })
propertySchema.index({ category: 1 });

propertySchema.index({ "location.locationGeo": "2dsphere" });


const Property = mongoose.model('Property', propertySchema);

export { Property };
