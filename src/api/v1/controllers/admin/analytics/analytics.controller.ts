import { NextFunction, Request, Response } from 'express';
import { Property } from '../../../models/property/property';
import { User } from '../../../models/user/user';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import * as adminAnalyticsUtils from './utils/admin.analytics.utils';

import { ApiError } from '../../../utils/error-handlers/ApiError';
import * as commonAnalyticsUtils from '../../common/analytics/services/analytics.service';

export async function analyticsStatisticsProperty(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const propertyFilter: Partial<{ visibility: 'draft' | 'published' }> = {
         visibility: 'published',
      };
      const userFilter: Partial<{ hasBasicDetails: boolean }> = {
         hasBasicDetails: true,
      };

      const totalProperties = await Property.countDocuments(propertyFilter);
      //trash line of code will fix after checking what is the use case...
      const totalUsers = await User.distinct('_id', {
         ...userFilter,
      }).then((users) => users.length);

      const propertyStats = await Property.aggregate([
         {
            $match: {
               ...propertyFilter,
            },
         },
         {
            $group: {
               _id: '$status',
               count: { $sum: 1 },
            },
         },
      ]);
      const userStats = await User.aggregate([
         { $match: { ...userFilter } },
         {
            $addFields: {
               role: {
                  $cond: {
                     if: {
                        $and: [
                           { $in: ['guest', '$role'] },
                           { $in: ['host', '$role'] },
                        ],
                     },
                     then: ['host'],
                     else: '$role',
                  },
               },
            },
         },
         { $unwind: { path: '$role', preserveNullAndEmptyArrays: true } },
         {
            $group: {
               _id: '$role',
               count: { $sum: 1 },
            },
         },
      ]);
      const userStatsData = userStats.reduce(
         (acc, { _id, count }) => {
            if (_id === 'guest') acc.guest_users = count;
            else if (_id === 'admin') acc.admin_users = count;
            else if (_id === 'host') acc.host_users = count;

            return acc;
         },
         { guest_users: 0, admin_users: 0, host_users: 0 },
      );

      const stats = propertyStats.reduce(
         (acc, { _id, count }) => {
            if (_id === 'active') acc.active_properties = count;
            if (_id === 'inactive') acc.inactive_properties = count;
            return acc;
         },
         { active_properties: 0, inactive_properties: 0 },
      );

      res.status(200).json({
         message: 'analytic statistics fetched successfully',
         data: { ...stats, ...userStatsData, totalProperties, totalUsers },
      });
   } catch (err) {
      console.error(err);
      next(err);
   }
}

export async function getAdminDashboardAnalytic(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const requestedCurrency = res.locals.currency as string
      const past6MonthsDateFormatter =
         commonAnalyticsUtils.getDateFormat('last6Months');

      const [
         properties,
         totalTransactions,
         users,
         reservations,
         totalRevenue,
         placeTypeStatsLast6Months,
         userStatsPastSixMonths,
         latestTransactions,
         newUnverifiedListings,
         top5CountryWithHigestBookings,
         reservationsStatsPastSixMonths,
      ] = await Promise.all([
         commonAnalyticsUtils.getTotalProperties(),
         commonAnalyticsUtils.getTotalTransactionGroupAmount({ status: { $ne: "open" } }, requestedCurrency),
         adminAnalyticsUtils.getTotalUsers(),
         commonAnalyticsUtils.getTotalReservations(),
         commonAnalyticsUtils.totalRevenue({}, requestedCurrency),
         adminAnalyticsUtils.getPropertyStatsByPlaceType(
            past6MonthsDateFormatter.range,
         ),
         adminAnalyticsUtils.getUserStats(
            past6MonthsDateFormatter.dateFormat,
            past6MonthsDateFormatter.range,
         ),
         adminAnalyticsUtils.getLatestTransactionsList(10),
         adminAnalyticsUtils.getNewUnverifeidListings(10),
         adminAnalyticsUtils.getTop5CountryWithHigestBookings(),
         commonAnalyticsUtils.getReservationStatsByStatus(
            '%m-%Y',
            past6MonthsDateFormatter.range,
         ),
      ]);

      return res.json(
         new ApiResponse(200, 'Dashboard fetched successfully.', {
            currency: requestedCurrency,
            properties,
            totalTransactions,
            users,
            reservations,
            totalRevenue: totalRevenue * 0.2,
            placeTypeStatsLast6Months,
            userStatsPastSixMonths,
            latestTransactions,
            newUnverifiedListings,
            top5CountryWithHigestBookings,
            reservationsStatsPastSixMonths,
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
   const { timeUnit } = req.query;
   const requestedCurrency = res.locals.currency
   try {
      if (!commonAnalyticsUtils.timeSpan.includes(timeUnit as string)) {
         throw new ApiError(
            400,
            'time unit query must be required and please provide either  | last7Days | last30Days | last12Months | last5Years',
         );
      }

      const revenueStatsDateFormatter = commonAnalyticsUtils.getDateFormat(
         timeUnit as commonAnalyticsUtils.TimeSpan,
      );

      const revenue = await commonAnalyticsUtils.getRevenueStats(
         revenueStatsDateFormatter.dateFormat,
         revenueStatsDateFormatter.range,
         {},
         requestedCurrency
      );

      res.status(200).json(
         new ApiResponse(200, 'Revenue for Dashboard fetched successfully', {
            currency: requestedCurrency,
            revenue,
         }),
      );
   } catch (err) {
      next(err);
   }
}
