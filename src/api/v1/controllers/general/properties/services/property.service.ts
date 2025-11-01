import mongoose from 'mongoose';
import { Reservation } from '../../../../models/reservation/reservation';
import { Property } from '../../../../models/property/property';
import moment from 'moment';
import { IPropertyPendingUpdates } from '../../../../models/property/types/property.model.types';

export async function getBlockDates(propertyId: mongoose.Types.ObjectId) {
   const todayDate = moment.utc().startOf('day').toDate();

   const reservations = await Reservation.find({
      propertyId: propertyId,
      checkOutDate: { $gte: todayDate },
      status: { $ne: "cancelled" },
   })
      .sort('checkInDate')
      .select('checkInDate checkOutDate')
      .lean();

   const mergedReservedRanges = [];

   reservations.forEach(({ checkInDate, checkOutDate }) => {
      const start = moment(checkInDate);
      // checkInDate < todayDate ? moment(todayDate) : moment(checkInDate);

      const end = moment(checkOutDate);

      if (mergedReservedRanges.length === 0) {
         mergedReservedRanges.push({
            checkInDate: start.toDate(),
            checkOutDate: end.toDate(),
         });
         return;
      }

      const lastRange = mergedReservedRanges[mergedReservedRanges.length - 1];
      const lastEnd = moment(lastRange.checkOutDate);

      // Check overlap or consecutive (same day or next day)
      if (start.isSame(lastEnd)) {
         lastRange.checkOutDate = moment.max(lastEnd, end).toDate();
      } else {
         mergedReservedRanges.push({
            checkInDate: start.toDate(),
            checkOutDate: end.toDate(),
         });
      }
   });
   return mergedReservedRanges;
}

export async function checkAvailableDate(
   checkIn: Date,
   checkOut: Date,
   propertyId: mongoose.Schema.Types.ObjectId,
   reservationId?: mongoose.Types.ObjectId,
) {
   const todayDate = moment.utc().startOf('day').toDate();

   // Parse and normalize check-in/check-out dates to UTC 00:00
   const startDate = moment.utc(checkIn).startOf('day');
   const endDate = moment.utc(checkOut).startOf('day');
   const filter: Record<string, { $ne: mongoose.Types.ObjectId }> = {};

   if (reservationId) {
      filter._id = { $ne: reservationId };
   }

   // Fetch property
   const property =
      await Property.findById(propertyId).select('availabilityWindow');

   // Calculate available end date (today + property availabilityWindow months)
   const availableEnd = moment
      .utc(todayDate)
      .startOf('day')
      .add(property.availabilityWindow, 'months');

   //maintain the rolling window boundary
   if (startDate.isBefore(todayDate) || endDate.isAfter(availableEnd)) {
      return false;
   }
   // Check if the requested dates fit within any available range
   const reservation = await Reservation.aggregate([
      {
         $match: {
            ...filter,
            propertyId: propertyId,
            status: { $in: ['complete', 'processing', 'open'] },
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
}

//specially made for host block patch request because check in date can be past while checkout date in future
// re create this module without breaking the existing thing
export async function checkAvailableDatesForHost(
   checkIn: Date,
   checkOut: Date,
   propertyId: mongoose.Schema.Types.ObjectId,
   reservationId?: mongoose.Types.ObjectId,
) {
   const todayDate = moment.utc().startOf('day').toDate();

   // Parse and normalize check-in/check-out dates to UTC 00:00
   const endDate = moment.utc(checkOut).startOf('day');
   const filter: Record<string, { $ne: mongoose.Types.ObjectId }> = {};

   if (reservationId) {
      filter._id = { $ne: reservationId };
   }

   // Fetch property
   const property =
      await Property.findById(propertyId).select('availabilityWindow');

   // Calculate available end date (today + property availabilityWindow months)
   const availableEnd = moment
      .utc(todayDate)
      .startOf('day')
      .add(property.availabilityWindow, 'months');
   if (endDate.isAfter(availableEnd)) {
      return false;
   }
   // Check if the requested dates fit within any available range
   const reservation = await Reservation.aggregate([
      {
         $match: {
            ...filter,
            propertyId: propertyId,
            status: { $in: ['complete', 'processing', 'open'] },
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
}


export function createUpdateStatus(lastUpdate?: IPropertyPendingUpdates) {
   const updateStatus: Record<string, any> = {}

   const status = lastUpdate?.status

   switch (status) {
      case 'pending': {
         updateStatus.state = status
         updateStatus.lastUpdateFields = {}
         updateStatus.dismissed = lastUpdate.isUserBannerDismissed
         break;
      }
      case 'rejected': {
         updateStatus.state = status
         updateStatus.lastUpdateFields = lastUpdate
         updateStatus.dismissed = lastUpdate.isUserBannerDismissed
         break;
      }
      default: {
         updateStatus.state = null
         updateStatus.lastUpdateFields = null
         updateStatus.dismissed = null
      }
   }

   return updateStatus
}