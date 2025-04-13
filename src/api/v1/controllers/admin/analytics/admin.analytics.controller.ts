import { NextFunction, Request, Response } from 'express';
import { Property } from '../../../models/property/property';
import { User } from '../../../models/user/user';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import * as adminAnalyticsUtils from './utils/admin.analytics.utils';

import { ApiError } from '../../../utils/error-handlers/ApiError';
import moment from 'moment';

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

// top 5 performing countries
export async function getAdminDashboardAnalytic(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { timeUnit, year } = req.query;
   const numericYear = Number(year);
   try {
      if (!['week', 'month', 'year'].includes(timeUnit as string)) {
         throw new ApiError(
            400,
            'time unit query must be required and please provide either year | week | month',
         );
      }

      if (numericYear < 2000 || numericYear > 2100) {
         return res
            .status(400)
            .json(new ApiResponse(400, 'Year must be between 2000 and 2100.'));
      }

      const startOfYear = moment
         .utc()
         .year(numericYear)
         .startOf('year')
         .toDate();
      const endOfYear = moment
         .utc()
         .year(Number(numericYear))
         .endOf('year')
         .toDate();

      const dateFormat = adminAnalyticsUtils.getDateFormat(timeUnit as string);

      const [
         userStats,
         revenue,
         totalProperty,
         totalUsers,
         totalReservations,
         top5CountriesWithHigestBooking,
      ] = await Promise.all([
         adminAnalyticsUtils.getUserStats(dateFormat, {
            startOfYear,
            endOfYear,
         }),
         adminAnalyticsUtils.getRevenueStats(dateFormat, {
            startOfYear,
            endOfYear,
         }),
         adminAnalyticsUtils.getTotalProperties(),
         adminAnalyticsUtils.getTotalUsers(),
         adminAnalyticsUtils.getTotalReservations(),
         adminAnalyticsUtils.getTop5CountryWithHigestBookings(),
      ]);

      res.status(200).json(
         new ApiResponse(200, 'Dashboard fetched successfully', {
            totalProperty,
            totalUsers,
            totalReservations,
            userStats,
            revenue,
            top5CountriesWithHigestBooking,
         }),
      );
   } catch (err) {
      next(err);
   }
}
