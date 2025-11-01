// ----------------- 🔧 Helpers ----------------------

import { User } from '../../../../models/user/user';
import { Reservation } from '../../../../models/reservation/reservation';
import { Property } from '../../../../models/property/property';
import { Transaction } from '../../../../models/reservation/transaction';
import { USER_STATUS } from '../../../../models/user/enums/user.enum';

export async function getUserStats(
   dateFormat: string,
   { startDate, endDate }: { startDate: Date; endDate: Date },
) {
   return User.aggregate([
      {
         $match: {
            hasBasicDetails: true,
            role: { $nin: ['admin'] },
            createdAt: { $gte: startDate, $lte: endDate },
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



interface IUserStats {
   host: { active: number, suspended: number, deleted: number, total: number },
   guest: { active: number, suspended: number, deleted: number, total: number }
}


export async function getTotalUsers() {

   const [rawUserStats] = await User.aggregate<IUserStats>([
      {
         $match: {
            status: { $ne: USER_STATUS.PENDING },
            role: { $ne: "admin" },
         }
      },
      {
         $addFields: {
            userType: {
               $cond: [{ $in: ["host", "$role"] }, "host", "guest"]
            }
         }
      },
      {
         $group: {
            _id: { userType: "$userType", status: "$status" },
            count: { $sum: 1 }
         }
      },
      {
         $group: {
            _id: "$_id.userType",
            statuses: { $push: { k: "$_id.status", v: "$count" } },
            total: { $sum: "$count" }
         }
      },
      {
         $project: {
            _id: 0,
            k: "$_id",
            v: {
               $mergeObjects: [
                  { active: 0, suspended: 0, deleted: 0 },
                  { $arrayToObject: "$statuses" },
                  { total: "$total" }
               ]
            }
         }
      },
      {
         $group: {
            _id: null,
            data: { $push: { k: "$k", v: "$v" } }
         }
      },
      {
         $replaceRoot: {
            newRoot: { $arrayToObject: "$data" }
         }
      }
   ]);


   if (!rawUserStats) {
      return { hostUsers: 0, guestUsers: 0, totalUser: 0 };
   }

   const hostUser = rawUserStats.host
   const guestUser = rawUserStats.guest

   const result = {
      activeGuestUsers: guestUser.active,
      activeHostUsers: hostUser.active,
      deletedUsers: guestUser.deleted + hostUser.deleted,
      suspendedUsers: guestUser.suspended + hostUser.suspended,
      totalUsers: guestUser.total + hostUser.total,
      rawUserStats
   }

   return result
}

export async function getTop5CountryWithHigestBookings() {
   const result = await Reservation.aggregate([
      {
         $match: { status: { $ne: 'open' } },
      },
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

export async function getLatestTransactionsList(limit: number) {

   const result = await Transaction.aggregate([
      {
         $match: { paymentStatus: { $ne: 'open' } },
      },
      {
         $lookup: {
            from: 'billings',
            localField: 'billingId',
            foreignField: '_id',
            as: 'billing',
         },
      },
      {
         $project: {
            _id: 0,
            reservationId: 1,
            transactionCode: 1,
            paymentStatus: 1,
            paymentAmount: 1,
            type: 1,
            currency: { $arrayElemAt: ['$billing.currency', 0] },
            createdAt: 1,
         },
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
   ]);
   return result;
}



export async function getNewUnverifeidListings(limit: number) {
   const result = await Property.find({ visibility: "draft", "verification.status": { $nin: ["verified", "open"] } })
      .sort({ updatedAt: -1 })
      .populate({
         path: 'hostId',
         select: 'firstName lastName email phone',
      })
      .limit(limit)
      .select('title hostId thumbnail location')
      .lean();

   return result;
}

export async function getPropertyStatsByPlaceType({ startDate, endDate }) {
   const result = await Reservation.aggregate([
      {
         $match: {
            status: { ne: 'open' },
            createdAt: { $gte: startDate, $lte: endDate },
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
                     propertyPlaceType: 1,
                  },
               },
            ],
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
            _id: '$property.propertyPlaceType',
            count: { $sum: 1 },
         },
      },
      {
         $project: {
            _id: 0,
            k: '$_id',
            v: '$count',
         },
      },
      {
         $group: {
            _id: null,
            data: { $push: { k: '$k', v: '$v' } },
         },
      },
      {
         $project: {
            _id: 0,
            result: { $arrayToObject: '$data' },
         },
      },
      {
         $replaceRoot: { newRoot: '$result' },
      },
   ]);

   return result[0];
}
