// ----------------- 🔧 Helpers ----------------------

import { User } from '../../../../models/user/user';
import { Reservation } from '../../../../models/reservation/reservation';
import { Property } from '../../../../models/property/property';

export function getDateFormat(groupBy: string): string {
   switch (groupBy) {
      case 'week':
         return '%G-W%V';
      case 'year':
         return '%Y';
      case 'month':
      default:
         return '%Y-%m';
   }
}

export async function getUserStats(
   dateFormat: string,
   { startOfYear, endOfYear }: { startOfYear: Date; endOfYear: Date },
) {
   return User.aggregate([
      {
         $match: {
            hasBasicDetails: true,
            role: { $nin: ['admin'] },
            createdAt: { $gte: startOfYear, $lte: endOfYear },
         },
      },
      {
         $addFields: {
            userType: {
               $cond: [{ $in: ['host', '$role'] }, 'host', 'guest'],
            },
            month: {
               $dateToString: { format: dateFormat, date: '$createdAt' },
            },
         },
      },
      {
         $group: {
            _id: {
               month: '$month',
               userType: '$userType',
            },
            count: { $sum: 1 },
         },
      },
      {
         $group: {
            _id: '$_id.month',
            hostUsers: {
               $sum: {
                  $cond: [{ $eq: ['$_id.userType', 'host'] }, '$count', 0],
               },
            },
            guestUsers: {
               $sum: {
                  $cond: [{ $eq: ['$_id.userType', 'guest'] }, '$count', 0],
               },
            },
         },
      },
      {
         $project: {
            _id: 0,
            xIndex: '$_id',
            hostUsers: 1,
            guestUsers: 1,
         },
      },
      {
         $sort: {
            xIndex: 1,
         },
      },
   ]);
}

export async function getRevenueStats(
   dateFormat: string,
   { startOfYear, endOfYear }: { startOfYear: Date; endOfYear: Date },
) {
   const result = await Reservation.aggregate([
      {
         $match: {
            status: 'complete',
            createdAt: { $gte: startOfYear, $lte: endOfYear },
         },
      },
      {
         $addFields: {
            unitTime: {
               $dateToString: { format: dateFormat, date: '$createdAt' },
            },
         },
      },
      {
         $lookup: {
            from: 'transactions',
            localField: '_id',
            foreignField: 'reservationId',
            as: 'transaction',
         },
      },
      {
         $unwind: {
            path: '$transaction',
            preserveNullAndEmptyArrays: false,
         },
      },
      {
         $facet: {
            hostRevenue: [
               {
                  $group: {
                     _id: {
                        unitTime: '$unitTime',
                     },
                     totalAmount: { $sum: '$transaction.paymentAmount' },
                  },
               },

               {
                  $project: {
                     x: '$_id.unitTime',
                     y: '$totalAmount',
                     _id: 0,
                  },
               },
               { $sort: { x: 1 } },
            ],
            guestRevenue: [
               {
                  $group: {
                     _id: {
                        unitTime: '$unitTime',
                     },
                     totalAmount: { $sum: '$transaction.paymentAmount' },
                  },
               },

               {
                  $project: {
                     x: '$_id.unitTime',
                     userId: '$_id.userId',
                     y: '$totalAmount',
                     _id: 0,
                  },
               },
               { $sort: { x: 1 } },
            ],
         },
      },
   ]);
   return result[0];
}

export async function getTotalProperties() {
   const result = await Property.aggregate([
      {
         $match: {
            visibility: 'published',
         },
      },
      {
         $group: {
            _id: null,
            totalProperties: { $sum: 1 },
         },
      },
      {
         $project: {
            _id: 0,
            totalProperties: 1,
         },
      },
   ]);
   return result[0]?.totalProperties || 0;
}

export async function getTotalUsers() {
   const result = await User.aggregate([
      {
         $match: {
            hasBasicDetails: true,
            role: { $nin: ['admin'] },
         },
      },
      {
         $group: {
            _id: null,
            usersCount: { $sum: 1 },
         },
      },
      {
         $project: {
            _id: 0,
            usersCount: 1,
         },
      },
   ]);
   return result[0]?.usersCount || 0;
}

export async function getTotalReservations() {
   const result = await Reservation.aggregate([
      {
         $match: {
            status: { $ne: 'open' },
         },
      },
      {
         $group: {
            _id: null,
            totalReservations: { $sum: 1 },
         },
      },
      {
         $project: {
            _id: 0,
            totalReservations: 1,
         },
      },
   ]);
   return result[0]?.totalReservations || 0;
}

export async function getTop5CountryWithHigestBookings() {
   const result = await Reservation.aggregate([
      {
         $group: {
            _id: '$propertyId',
            count: { $sum: 1 },
         },
      },
      {
         $project: {
            _id: 0,
            propertyId: '$_id',
            bookingCnt: '$count',
         },
      },
      {
         $lookup: {
            from: 'properties',
            localField: 'propertyId',
            foreignField: '_id',
            as: 'property',
         },
      },
      {
         $unwind: {
            path: '$property',
            preserveNullAndEmptyArrays: false,
         },
      },
      {
         $group: {
            _id: '$property.location.country',
            totalBookingCnt: { $sum: '$bookingCnt' },
         },
      },
      {
         $project: {
            _id: 0,
            country: '$_id',
            totalBookingCnt: 1,
         },
      },
      {
         $sort: { totalBookingCnt: -1 },
      },
      {
         $limit: 5,
      },
   ]);
   return result;
}
