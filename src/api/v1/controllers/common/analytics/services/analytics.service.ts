import moment from 'moment';
import { Property } from '../../../../models/property/property';
import { Reservation } from '../../../../models/reservation/reservation';
import { ApiError } from '../../../../utils/error-handlers/ApiError';
import {
   eachDayOfInterval,
   eachMonthOfInterval,
   eachYearOfInterval,
   format,
} from 'date-fns';
import { PipelineStage } from 'mongoose';
import { generatePipeForCurrencyConversion } from '../../../../utils/aggregation-pipelines/agregation.utils';

export const timeSpan = [
   'last7Days',
   'last30Days',
   'last12Months',
   'last5Years',
   'last6Months',
];
export type TimeSpan = (typeof timeSpan)[number];

export function getDateFormat(groupBy: TimeSpan, year = moment().year()) {
   const now = moment.utc();

   switch (groupBy) {
      case 'last7Days':
         return {
            dateFormat: '%d-%m-%Y',
            range: {
               startDate: moment
                  .utc()
                  .subtract(6, 'days')
                  .startOf('day')
                  .toDate(),
               endDate: now.clone().toDate(),
            },
         };
      case 'last30Days':
         return {
            dateFormat: '%d-%m-%Y',
            range: {
               startDate: moment
                  .utc()
                  .subtract(1, 'month')
                  .startOf('day')
                  .toDate(),
               endDate: now.clone().toDate(),
            },
         };
      case 'last12Months':
         return {
            dateFormat: '%m-%Y',
            range: {
               startDate: moment
                  .utc()
                  .subtract(11, 'month')
                  .startOf('day')
                  .toDate(),
               endDate: now.clone().toDate(),
            },
         };

      case 'last6Months':
         return {
            dateFormat: '%m-%Y',
            range: {
               startDate: moment
                  .utc()
                  .subtract(5, 'months')
                  .startOf('day')
                  .toDate(),
               endDate: now.clone().toDate(),
            },
         };
      case 'last5Years':
         return {
            dateFormat: '%Y',
            range: {
               startDate: moment
                  .utc()
                  .subtract(4, 'year')
                  .startOf('day')
                  .toDate(),
               endDate: now.clone().toDate(),
            },
         };
      case 'fullYearOfCustomYear':
         return {
            dateFormat: '%m-%Y',
            range: {
               startDate: moment
                  .utc()
                  .year(year)
                  .subtract(11, 'month')
                  .startOf('day')
                  .toDate(),
               endDate: now.clone().year(year).toDate(),
            },
         };
      default:
         throw new ApiError(400, 'not implemented');
   }
}

export async function getTotalProperties(filter = {}) {
   const [result] = await Property.aggregate([
      {
         $match: {
            visibility: 'published',
            ...filter,
         },
      },
      {
         $project: {
            status: 1
         }
      },
      {

         $group: {
            _id: '$status',
            count: { $sum: 1 },
         },
      },
      {
         $group: {
            _id: null,
            data: {
               $push: {
                  k: '$_id',
                  v: '$count',
               },
            },
         },
      },
      {
         $replaceRoot: {
            newRoot: {
               $arrayToObject: '$data',
            },
         },
      },
      {
         $addFields: {
            activeProperties: { $ifNull: ['$active', 0] },
            inactiveProperties: { $ifNull: ['$inactive', 0] },
            suspendedProperties: { $ifNull: ['$suspended', 0] },
            deletedProperties: { $ifNull: ['$deleted', 0] },
         },
      },
      {
         $project: {
            _id: 0,
            activeProperties: 1,
            inactiveProperties: 1,
            suspendedProperties: 1,
            deletedProperties: 1,
            totalProperties: {
               $add: ['$activeProperties', '$inactiveProperties', '$suspendedProperties', '$deletedProperties'],
            },
         },
      },
   ]);
   return (
      result || {
         activeProperties: 0,
         inactiveProperties: 0,
         suspendedProperties: 0,
         deletedProperties: 0,
         totalProperties: 0,
      }
   );
}

export async function getTotalReservations(filter = {}) {
   const result = await Reservation.aggregate([
      {
         $match: {
            status: { $ne: 'open' },
            ...filter,
         },
      },
      {
         $group: {
            _id: '$status',
            totalReservations: { $sum: 1 },
         },
      },

      {
         $group: {
            _id: null,
            data: {
               $push: {
                  k: '$_id',
                  v: '$totalReservations',
               },
            },
         },
      },
      {
         $replaceRoot: {
            newRoot: {
               $arrayToObject: '$data',
            },
         },
      },
      {
         $addFields: {
            complete: { $ifNull: ['$complete', 0] },
            cancelled: { $ifNull: ['$cancelled', 0] },
         },
      },
      {
         $project: {
            _id: 0,
            complete: 1,
            cancelled: 1,
            totalReservations: {
               $add: ['$complete', '$cancelled'],
            },
         },
      },
   ]);
   return result[0] || { complete: 0, cancelled: 0, totalReservations: 0 };
}
//below supports earning host wise as well as entire platform transactions
export async function getTotalTransactionGroupAmount(filter = {}, requestedCurrency: string) {

   const currencyConversionPipe = await generatePipeForCurrencyConversion(
      {
         baseAmountAttribute: '$exactTransactionAmount',
         baseCurrencyAttribute: "$transactionCurrency",
         includeExchangeRate: true,
         requestCurrency: requestedCurrency,
         outputField: "finalConvertedCurrency"
      }
   )
   const result = await Reservation.aggregate([
      { $match: filter },
      {
         $lookup: {
            from: "transactions",
            localField: "_id",
            foreignField: "reservationId",
            as: "transaction"
         }
      },
      { $unwind: { path: '$transaction', preserveNullAndEmptyArrays: false } },

      {
         $addFields: {
            exactTransactionAmount: { $multiply: ['$transaction.paymentAmount', 1.1] },
            transactionCurrency: { $toLower: '$transaction.currency' },
            transactionPaymentStatus: '$transaction.paymentStatus'
         }
      },
      ...currencyConversionPipe,
      {
         $group: {
            _id: '$transactionPaymentStatus',
            groupAmt: { $sum: '$finalConvertedCurrency' },
         },
      },

      {
         $group: {
            _id: null,
            data: {
               $push: {
                  k: '$_id',
                  v: '$groupAmt'
               }
            }
         }
      },
      {
         $replaceRoot: {
            newRoot: {
               $arrayToObject: '$data'
            }
         }
      }
   ]);

   return (result[0] || {
      paid: 0,
      refunded: 0,
   }) as {
      paid: number;
      refunded: number;
   };
}

export async function getReservationStatsByStatus(
   dateFormat: string,
   { startDate, endDate }: { startDate: Date; endDate: Date },
   filter = {},
) {
   const result = await Reservation.aggregate([
      {
         $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'open' },
            ...filter,
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
         $group: {
            _id: {
               unitTime: '$unitTime',
               status: '$status',
            },

            count: { $sum: 1 },
         },
      },
      {
         $group: {
            _id: '$_id.unitTime',
            complete: {
               $sum: {
                  $cond: [{ $eq: ['$_id.status', 'complete'] }, '$count', 0],
               },
            },
            cancelled: {
               $sum: {
                  $cond: [{ $eq: ['$_id.status', 'cancelled'] }, '$count', 0],
               },
            },
         },
      },
      {
         $project: {
            _id: 0,
            unitTime: '$_id',
            complete: 1,
            cancelled: 1,
         },
      },
      {
         $sort: {
            unitTime: 1,
         },
      },
   ]);

   const allMonths = eachMonthOfInterval({
      start: startDate,
      end: endDate,
   }).map((d) => format(d, 'MM-yyyy'));

   const padded = allMonths.map((day) => {
      const existing = result.find((r) => r.unitTime === day);
      return (
         existing || {
            unitTime: day,
            complete: 0,
            cancelled: 0,
         }
      );
   });
   return padded;
}
export async function getRevenueStats(
   dateFormat: string,
   { startDate, endDate }: { startDate: Date; endDate: Date },
   filter = {},
   requestCurrency: string,
) {

   const guestCurrency = requestCurrency


   const currencyConversionPipe = await generatePipeForCurrencyConversion(
      {
         baseAmountAttribute: '$exactBillingAmount',
         baseCurrencyAttribute: "$billingCurrency",
         includeExchangeRate: true,
         requestCurrency: guestCurrency,
         outputField: "finalConvertedCurrency"
      }
   )
   const matchFilter = {
      status: { $ne: "open" },
      createdAt: { $gte: startDate, $lte: endDate },
      ...filter,
   }
   //get revenue from reservation as it stable source to generate income stats
   const pipeline: PipelineStage[] = [

      {
         $match: matchFilter
      },

      {
         $lookup: {
            from: "billings",
            localField: "_id",
            foreignField: "reservationId",

            as: "billing"
         }
      },
      { $unwind: { path: '$billing', preserveNullAndEmptyArrays: false } },

      {
         $addFields: {
            exactBillingAmount: {
               $subtract: [
                  "$billing.totalAmountPaid",
                  { $ifNull: ["$billing.totalRefunded", 0] }
               ]
            },
            billingCurrency: { $toLower: '$billing.currencyExchangeRate.targetCurrency' }
         }
      },

      //this raw pipe will take care of currency conversion
      ...currencyConversionPipe,


      {
         $group: {
            _id: {
               id: "$_id",
               paymentDate: '$createdAt'
            },
            totalPaymentAmount: { $sum: '$finalConvertedCurrency' },

         },
      },
      {
         $addFields: {
            unitTime: {
               $dateToString: { format: dateFormat, date: '$_id.paymentDate' },
            },
         },
      },
      {
         $project: {

            unitTime: 1,
            guestPaid: { $multiply: ['$totalPaymentAmount', 1.1] },
            hostEarned: { $multiply: ['$totalPaymentAmount', 0.9] },
            platformFee: { $multiply: ['$totalPaymentAmount', 0.2] },
         },
      },
      {
         $group: {
            _id: '$unitTime',
            guestPaid: { $sum: '$guestPaid' },
            hostEarned: { $sum: '$hostEarned' },
            platformFee: { $sum: '$platformFee' },
         },
      },
      {
         $project: {
            _id: 0,
            unitTime: '$_id',
            guestPaid: 1,
            hostEarned: 1,
            platformFee: 1,
         },
      },
      { $sort: { unitTime: 1 } },

   ]

   const result = await Reservation.aggregate(pipeline)

   let allUnits: string[];

   switch (dateFormat) {
      case '%m-%Y':
         allUnits = eachMonthOfInterval({ start: startDate, end: endDate }).map(
            (d) => format(d, 'MM-yyyy'),
         );
         break;
      case '%d-%m-%Y':
         allUnits = eachDayOfInterval({ start: startDate, end: endDate }).map(
            (d) => format(d, 'dd-MM-yyyy'),
         );
         break;
      case '%Y':
         allUnits = eachYearOfInterval({ start: startDate, end: endDate }).map(
            (d) => format(d, 'yyyy'),
         );
         break;
      default:
         throw new ApiError(400, 'Date format not implemented');
   }

   const padded = allUnits.map((unit) => {
      const existing = result.find((r) => r.unitTime === unit);
      return (
         existing || {
            unitTime: unit,
            guestPaid: 0,
            hostEarned: 0,
            platformFee: 0,
         }
      );
   });

   return padded;
}


export async function totalRevenue(filter = {}, guestCurrency: string) {

   // const currencyConversionPipe = await generatePipeForCurrencyConversion(guestCurrency, "$billingCurrency", "$exactBillingAmount")

   const currencyConversionPipe = await generatePipeForCurrencyConversion(
      {
         baseAmountAttribute: '$exactBillingAmount',
         baseCurrencyAttribute: "$billingCurrency",
         includeExchangeRate: true,
         requestCurrency: guestCurrency,
         outputField: "finalConvertedCurrency"
      }
   )

   const matchFilter = {
      status: { $ne: 'open' }, ...filter,
   }
   const result = await Reservation.aggregate([
      {
         $match: matchFilter,
      },
      {
         $lookup: {
            from: "billings",
            localField: "_id",
            foreignField: "reservationId",
            as: "billing"
         }
      },
      { $unwind: { path: '$billing', preserveNullAndEmptyArrays: false } },

      {
         $addFields: {
            exactBillingAmount: {
               $subtract: [
                  "$billing.totalAmountPaid",
                  { $ifNull: ["$billing.totalRefunded", 0] }
               ]
            },
            billingCurrency: { $toLower: '$billing.currencyExchangeRate.targetCurrency' }
         }
      },
      ...currencyConversionPipe,
      {
         $group: {
            _id: null,
            totalRevenue: { $sum: '$finalConvertedCurrency' },
         },
      },
      {
         $project: {
            _id: 0,
         },
      },
   ]);


   return result[0]?.totalRevenue || 0
}