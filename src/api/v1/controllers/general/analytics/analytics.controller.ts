import { NextFunction, Response, Request } from 'express';
import * as commonAnalyticsUtils from '../../common/analytics/services/analytics.service';
import * as generalAnalyticsUtils from './analytics.service';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import moment from 'moment';
import { PipelineStage } from 'mongoose';
import { Reservation } from '../../../models/reservation/reservation';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { Property } from '../../../models/property/property';
import { ApiError } from '../../../utils/error-handlers/ApiError';

export async function getHostDashboardAnalytic(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sessionUser = req.user as ISessionUser;
   const hostFilter = { hostId: sessionUser?._id };
   const requestedCurrency = res.locals.currency
   try {
      const customDateRanges =
         commonAnalyticsUtils.getDateFormat('last6Months');
      const [
         properties,
         reservations,
         totalEarnings,
         allTimeReservationCountPropertyWise,
         upcomingReservationsCount,
         reservationStatsLast6months,
         latestHostReservations,
      ] = await Promise.all([
         generalAnalyticsUtils.getPropertiesCountStats(hostFilter),
         commonAnalyticsUtils.getTotalReservations(hostFilter),
         commonAnalyticsUtils.totalRevenue(hostFilter, requestedCurrency),
         generalAnalyticsUtils.getAllTimeReservationCountPropertyWise(
            hostFilter,
         ),
         generalAnalyticsUtils.getUpcommingReservationsCount(hostFilter),
         commonAnalyticsUtils.getReservationStatsByStatus(
            '%m-%Y',
            customDateRanges.range,
            hostFilter,
         ),
         generalAnalyticsUtils.getLatestReservationsHostWise(hostFilter),
      ]);


      res.status(200).json(
         new ApiResponse(200, 'Dashboard fetched successfully.', {
            currency: requestedCurrency,
            properties,
            reservations,
            totalEarnings: totalEarnings * 0.9,
            allTimeReservationCountPropertyWise,
            upcomingReservationsCount,
            reservationStatsLast6months,
            latestHostReservations,
         }),
      );
   } catch (err) {
      next(err);
   }
}

export async function getRevenueDashboardAnalytic(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const requestedCurrency = res.locals.currency
   const serverCurrentYear = moment().year();
   const { year = serverCurrentYear } = req.query;
   const sessionUser = req.user as ISessionUser;
   try {
      if (
         !year ||
         isNaN(Number(year)) ||
         Number(year) < 2022 ||
         Number(year) > serverCurrentYear
      ) {
         return res
            .status(400)
            .json(
               new ApiResponse(400, 'Invalid or missing year parameter', null),
            );
      }
      const revenueStatsDateFormatter = commonAnalyticsUtils.getDateFormat(
         'fullYearOfCustomYear',
         Number(year),
      );

      const revenue = await commonAnalyticsUtils.getRevenueStats(
         revenueStatsDateFormatter.dateFormat,
         revenueStatsDateFormatter.range,
         { hostId: sessionUser._id },
         requestedCurrency
      );

      return res.json(
         new ApiResponse(200, 'Revenue for Dashboard fetched successfully', {
            currency: requestedCurrency,
            revenue,
         }),
      );
   } catch (err) {
      next(err);
   }
}
export async function getTransactionsInsights(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const sessionUser = req.user as ISessionUser;
      const { year = moment().year(), month = moment().month() + 1 } =
         req.query;

      // Validate year and month
      const numericYear = parseInt(year as string);
      const numericMonth = parseInt(month as string);
      if (
         isNaN(numericYear) ||
         isNaN(numericMonth) ||
         numericMonth < 1 ||
         numericMonth > 12
      ) {
         return res.status(400).json({ error: 'Invalid year or month format' });
      }
      const daysInMonth = moment(`${year}-${month}`, 'YYYY-M').daysInMonth();
      const startDate = moment
         .utc(`${numericYear}-${numericMonth}`, 'YYYY-M')
         .startOf('month')
         .toDate();
      const endDate = moment
         .utc(startDate)
         .endOf('month')
         .startOf('day')
         .toDate();
      const propertyId = validateObjectId(req.params.propertyId);
      const property = await Property.findOne({
         _id: propertyId,
         hostId: sessionUser._id,
      }).select('_id title location status');
      if (!property) {
         throw new ApiError(404, 'No property found.');
      }
      const filter = {
         hostId: sessionUser._id,
         status: {
            $nin: ['open', 'cancelled'],
         },
         propertyId,
         checkInDate: {
            $lte: endDate,
         },
         checkOutDate: {
            $gt: startDate,
         },
      };

      const pipeline: PipelineStage[] = [
         {
            $facet: {
               reservationStats: [
                  {
                     $match: filter,
                  },
                  {
                     $addFields: {
                        stayLengthDays: {
                           $dateDiff: {
                              startDate: {
                                 $cond: [
                                    {
                                       $gt: ['$checkInDate', startDate],
                                    },
                                    '$checkInDate',
                                    startDate,
                                 ],
                              },
                              endDate: {
                                 $switch: {
                                    branches: [
                                       {
                                          case: {
                                             $lt: ['$checkOutDate', endDate],
                                          },
                                          then: '$checkOutDate',
                                       },
                                       {
                                          case: {
                                             $gt: ['$checkOutDate', endDate],
                                          },
                                          then: {
                                             $dateAdd: {
                                                startDate: endDate,
                                                unit: 'day',
                                                amount: 1,
                                             },
                                          },
                                       },
                                    ],
                                    default: endDate,
                                 },
                              },
                              unit: 'day',
                           },
                        },
                     },
                  },
                  {
                     $group: {
                        _id: null,
                        selfReservations: {
                           $sum: {
                              $cond: [{ $eq: ['$isSelfBooked', true] }, 1, 0],
                           },
                        },
                        guestReservations: {
                           $sum: {
                              $cond: [
                                 {
                                    $and: [
                                       { $eq: ['$isSelfBooked', false] },
                                       { $eq: ['$status', 'complete'] },
                                    ],
                                 },
                                 1,
                                 0,
                              ],
                           },
                        },

                        totalReservations: { $sum: 1 },
                        guestBookedNights: {
                           $sum: {
                              $cond: [
                                 { $eq: ['$isSelfBooked', false] },
                                 '$stayLengthDays',
                                 0,
                              ],
                           },
                        },
                        selfBookedNights: {
                           $sum: {
                              $cond: [
                                 { $eq: ['$isSelfBooked', true] },
                                 '$stayLengthDays',
                                 0,
                              ],
                           },
                        },
                        totalNights: { $sum: '$stayLengthDays' },
                     },
                  },
                  {
                     $project: {
                        _id: 0,
                        selfReservations: 1,
                        guestReservations: 1,
                        totalReservations: 1,
                        guestBookedNights: 1,
                        selfBookedNights: 1,
                        totalNights: 1,
                        avgNights: { $divide: ['$totalNights', daysInMonth] },
                     },
                  },
               ],
               earningInsights: [
                  {
                     $match: {
                        ...filter,
                        isSelfBooked: false,
                     },
                  },
                  {
                     $lookup: {
                        from: 'billings',
                        localField: '_id',
                        foreignField: 'reservationId',
                        as: 'billings',
                     },
                  },
                  {
                     $unwind: {
                        path: '$billings',
                        preserveNullAndEmptyArrays: false,
                     },
                  },
                  {
                     $project: {
                        paymentAmount: {
                           $subtract: [
                              { $ifNull: ['$billings.totalAmountPaid', 0] },
                              { $ifNull: ['$billings.totalRefunded', 0] },
                           ],
                        },
                        serviceFees: '$billings.additionalFees.service',
                        cleaningFees: '$billings.additionalFees.cleaning',
                        tax: '$billings.additionalFees.tax',
                     },
                  },
                  {
                     $group: {
                        _id: null,
                        totalHostEarning: {
                           $sum: {
                              $multiply: ['$paymentAmount', 0.9],
                           },
                        },

                        totalServiceFees: {
                           $sum: '$serviceFees',
                        },
                        totalCleaningFees: {
                           $sum: '$cleaningFees',
                        },
                        totalTax: {
                           $sum: '$tax',
                        },
                        totalGuestPaid: {
                           $sum: {
                              $multiply: ['$paymentAmount', 1.1],
                           },
                        },
                        totalPlatformFees: {
                           $sum: {
                              $multiply: ['$paymentAmount', 0.2],
                           },
                        },
                     },
                  },
                  {
                     $project: { _id: 0 },
                  },
               ],
            },
         },
         {
            $project: {
               reservationStats: {
                  $ifNull: [
                     { $arrayElemAt: ['$reservationStats', 0] },
                     {
                        selfReservations: 0,
                        guestReservations: 0,
                        cancelledReservations: 0,
                        totalReservations: 0,
                        guestBookedNights: 0,
                        selfBookedNights: 0,
                        totalNights: 0,
                        avgNights: 0,
                     },
                  ],
               },
               earningInsights: {
                  $ifNull: [
                     { $arrayElemAt: ['$earningInsights', 0] },
                     {
                        totalHostEarning: 0,
                        totalGuestPaid: 0,
                        totalPlatformFees: 0,
                        totalServiceFees: 0,
                        totalCleaningFees: 0,
                        totalTax: 0,
                     },
                  ],
               },
            },
         },
      ];

      const result = await Reservation.aggregate(pipeline);
      return res
         .status(200)
         .json({ stats: result[0], propertyDetails: property });
   } catch (error) {
      next(error);
   }
}
