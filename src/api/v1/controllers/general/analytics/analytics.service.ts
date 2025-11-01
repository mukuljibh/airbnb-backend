import { Reservation } from '../../../models/reservation/reservation';
import { Property } from '../../../models/property/property';

export async function getAllTimeReservationCountPropertyWise(filter = {}) {
   const result = await Reservation.aggregate([
      {
         $match: {
            ...filter,
            status: { $ne: 'open' },
         },
      },

      {
         $group: {
            _id: '$propertyId',
            reservationCount: {
               $sum: 1,
            },
         },
      },
      {
         $lookup: {
            from: 'properties',
            localField: '_id',
            foreignField: '_id',
            pipeline: [
               {
                  $project: {
                     title: 1,
                     thumbnail: 1,
                  },
               },
            ],
            as: 'property',
         },
      },
      {
         $unwind: {
            path: '$property',
            preserveNullAndEmptyArrays: true,
         },
      },
      {
         $project: {
            _id: 0,
         },
      },
      {
         $sort: {
            reservationCount: -1,
         },
      },
   ]);
   return result;
}

export async function getUpcommingReservationsCount(filter = {}) {
   const result = await Reservation.aggregate([
      {
         $match: {
            status: { $nin: ['open', 'cancelled'] },
            checkInDate: { $gt: new Date() },
            ...filter,
         },
      },
      {
         $count: 'count',
      },
   ]);

   return result[0]?.count || 0;
}
export async function getPropertiesCountStats(filter = {}) {

   const matchFilter = {
      ...filter,
   }
   const result = await Property.aggregate([
      {
         $match: matchFilter,
      },
      {
         $facet: {
            activePublishedProperties: [
               { $match: { visibility: 'published', status: 'active' } },
               { $count: 'count' },
            ],
            inactivePublishedProperties: [
               { $match: { visibility: 'published', status: 'inactive' } },
               { $count: 'count' },
            ],
            totalPublishedProperties: [
               { $match: { visibility: 'published' } },
               { $count: 'count' },
            ],
            totalDrafts: [
               { $match: { visibility: 'draft' } },
               { $count: 'count' },
            ],
            totalProperties: [{ $count: 'count' }],
         },
      },
      {
         $project: {
            activePublishedProperties: {
               $ifNull: [
                  { $arrayElemAt: ['$activePublishedProperties.count', 0] },
                  0,
               ],
            },
            inactivePublishedProperties: {
               $ifNull: [
                  { $arrayElemAt: ['$inactivePublishedProperties.count', 0] },
                  0,
               ],
            },
            totalPublishedProperties: {
               $ifNull: [
                  { $arrayElemAt: ['$totalPublishedProperties.count', 0] },
                  0,
               ],
            },
            totalDrafts: {
               $ifNull: [{ $arrayElemAt: ['$totalDrafts.count', 0] }, 0],
            },
            totalProperties: {
               $ifNull: [{ $arrayElemAt: ['$totalProperties.count', 0] }, 0],
            },
         },
      },
   ]);

   return result[0];
}

export async function getLatestReservationsHostWise(filter = {}) {
   const result = await Reservation.aggregate([
      {
         $match: {
            status: { $nin: ['open', 'processing'] },
            isSelfBooked: false,
            ...filter,
         },
      },
      {
         $lookup: {
            from: 'properties',
            localField: 'propertyId',
            foreignField: '_id',
            pipeline: [
               {
                  $project: {
                     title: 1,
                  },
               },
            ],
            as: 'property',
         },
      },
      {
         $unwind: {
            path: '$property',
            preserveNullAndEmptyArrays: true,
         },
      },
      {
         $sort: { updatedAt: -1 },
      },
      {
         $limit: 10,
      },
   ]);

   return result;
}
