import mongoose from 'mongoose';
import { Types } from 'mongoose';
import UserQuery from '../../../../models/userQuery';
import { formatPaginationResponse } from '../../../../utils/pagination/pagination.utils';
import moment from 'moment';
import { Reservation } from '../../../../models/reservation/reservation';

export async function getUserQueriesList(
   filter: Record<string, string>,
   queryParams: {
      searchTerm: string;
   },
   pageAttr,
) {
   const { searchTerm } = queryParams;
   const matchFilter: Record<string, unknown> = { ...filter };

   if (searchTerm && searchTerm !== '') {
      matchFilter.$or = [
         { title: { $regex: searchTerm, $options: 'i' } },
         { name: { $regex: searchTerm, $options: 'i' } },
         { email: { $regex: searchTerm, $options: 'i' } },
         { subject: { $regex: searchTerm, $options: 'i' } },
      ];
   }
   const queriesAggregation = UserQuery.aggregate([
      {
         $match: matchFilter,
      },
      { $sort: { createdAt: -1 } },
      { $skip: pageAttr.startIndex },
      { $limit: pageAttr.limit },
   ]);

   const countAggregation = UserQuery.countDocuments(matchFilter);
   const [queries, queriesCount] = await Promise.all([
      queriesAggregation,
      countAggregation,
   ]);

   const result = formatPaginationResponse(queries, queriesCount, pageAttr);
   return result;
}


export async function doesHostHaveActiveOrUpcomingReservation(hostId: Types.ObjectId) {
   const now = moment.utc().startOf('date').toDate();

   const filter = {
      status: { $ne: 'cancelled' },
      $or: [
         { checkInDate: { $gt: now } },
         { checkInDate: { $lte: now }, checkOutDate: { $gte: now } }
      ]
   }
   const pendingHostReservation = await Reservation.findOne({
      hostId: hostId,
      ...filter
   }).select('_id');

   const pendingTrips = await Reservation.findOne({
      userId: hostId,
      ...filter
   }).select('_id');

   return pendingHostReservation || pendingTrips
}