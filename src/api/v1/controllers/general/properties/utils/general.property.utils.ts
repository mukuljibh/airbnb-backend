import mongoose from 'mongoose';
import { Reservation } from '../../../../models/reservation/reservation';
import { Property } from '../../../../models/property/property';
import moment from 'moment';

const todayDate = moment.utc().startOf('day').toDate();
export async function getBlockDates(propertyId: mongoose.Types.ObjectId) {
   const reservations = await Reservation.find({
      propertyId: propertyId,
      checkOutDate: { $gte: todayDate },
      status: { $in: ['complete', 'open', 'processing'] },
   })
      .sort('checkInDate')
      .select('checkInDate checkOutDate');

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
      if (start.diff(lastEnd, 'days') <= 1) {
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
   // Parse and normalize check-in/check-out dates to UTC 00:00
   const startDate = moment.utc(checkIn).startOf('day');
   const endDate = moment.utc(checkOut).startOf('day');
   const filter: Record<string, { $ne: mongoose.Types.ObjectId }> = {};

   if (reservationId) {
      filter._id = { $ne: reservationId };
   }

   // console.log(moment.utc('2025-06-07').isSame(moment.utc(checkOut)));
   // console.log(moment.utc('2025-06-07'), moment.utc(checkOut));

   // Fetch property
   const property =
      await Property.findById(propertyId).select('availabilityWindow');

   // Calculate available end date (today + property availabilityWindow months)
   const availableEnd = moment
      .utc(todayDate)
      .startOf('day')
      .add(property.availabilityWindow, 'months');
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
