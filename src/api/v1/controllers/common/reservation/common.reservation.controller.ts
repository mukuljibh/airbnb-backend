import { ISessionUser } from '../../../models/user/types/user.model.types';
import { Response, Request, NextFunction } from 'express';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { Property } from '../../../models/property/property';
import { Reservation } from '../../../models/reservation/reservation';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { PipelineStage } from 'mongoose';
import { getUserFromDb } from '../../../utils/aggregation-pipelines/agregation.utils';

export async function getHostPropertiesWithReservations(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const query = req.query as {
      sortField?: string;
      sortOrder: string;
      searchTerm: string;
   };
   const sessionUser = req.user as ISessionUser;
   try {
      const user = await getUserFromDb(sessionUser._id);
      if (
         query.sortField &&
         ![
            'checkInDate',
            'checkOutDate',
            'pricePerNight',
            'numberOfNights',
            'firstName',
            'createdAt',
         ].includes(query?.sortField)
      ) {
         throw new ApiError(
            400,
            `sort field must be 'checkInDate', 'checkOutDate', 'pricePerNight', 'numberOfNights','firstName'`,
         );
      }
      const sortDirection = query.sortOrder === 'desc' ? -1 : 1;
      const { status } = req.query;

      // Validate status
      if (
         !['complete', 'cancelled', 'open', 'all'].includes(status as string)
      ) {
         throw new ApiError(
            400,
            'these are valid status values: complete | cancelled | open | all',
         );
      }

      // Host/admin filter
      const privilegeFilter = user.role.includes('admin')
         ? {}
         : { hostId: user._id };

      // Status filter - only apply if not 'all'
      let reservationFilter = {};
      if (status !== 'all') {
         if (status === 'complete') {
            reservationFilter = {
               status: { $in: ['complete', 'processing'] },
            };
         } else {
            reservationFilter = { status };
         }
      }

      const userFilter: Record<string, unknown> = {};
      if (query.searchTerm && query.searchTerm.trim() !== '') {
         userFilter.$or = [
            { firstName: { $regex: query.searchTerm, $options: 'i' } },
            { email: { $regex: query.searchTerm, $options: 'i' } },
         ];
      }

      const pagesAttr = res.locals.pagination;
      const propertyId = validateObjectId(req.params.propertyId);
      const propertyDetails =
         await Property.findById(propertyId).select('title');
      if (!propertyDetails) {
         throw new ApiError(500, 'Something went wrong, property not found');
      }

      const pipeline: PipelineStage[] = [
         {
            $match: {
               _id: propertyId,
               ...privilegeFilter,
            },
         },
         {
            $lookup: {
               from: 'reservations',
               localField: '_id',
               foreignField: 'propertyId',
               pipeline: [
                  { $match: reservationFilter },
                  { $sort: { [query.sortField]: sortDirection } },
                  { $skip: pagesAttr.startIndex },
                  { $limit: pagesAttr.limit },
               ],
               as: 'reservations',
            },
         },
         {
            $unwind: {
               path: '$reservations',
               preserveNullAndEmptyArrays: false,
            },
         },
         {
            $lookup: {
               from: 'users',
               localField: 'reservations.userId',
               foreignField: '_id',
               pipeline: [
                  {
                     $match: userFilter,
                  },
                  {
                     $project: {
                        _id: 0,
                        firstName: 1,
                        lastName: 1,
                        profilePicture: 1,
                        email: 1,
                        phone: 1,
                        address: 1,
                     },
                  },
               ],
               as: 'reservations.userDetails',
            },
         },
         {
            $unwind: {
               path: '$reservations.userDetails',
               preserveNullAndEmptyArrays: false,
            },
         },
         {
            $lookup: {
               from: 'billings',
               localField: 'reservations._id',
               foreignField: 'reservationId',
               pipeline: [{ $sort: { pricePerNight: -1 } }],
               as: 'reservations.billing',
            },
         },
         {
            $unwind: {
               path: '$reservations.billing',
               preserveNullAndEmptyArrays: false,
            },
         },
      ];

      // Sorting logic
      if (query.sortField === 'pricePerNight') {
         pipeline.push({
            $sort: { 'reservations.billing.pricePerNight': sortDirection },
         });
      }
      if (query.sortField === 'numberOfNights') {
         pipeline.push({
            $sort: { 'reservations.billing.numberOfNights': sortDirection },
         });
      }
      if (query.sortField === 'firstName') {
         pipeline.push({
            $sort: { 'reservations.userDetails.firstName': sortDirection },
         });
      }

      pipeline.push(
         {
            $group: {
               _id: '$_id',
               title: { $first: '$title' },
               reservations: { $push: '$reservations' },
            },
         },
         {
            $project: {
               _id: 0,
               reservations: 1,
            },
         },
      );

      const reservations = await Property.aggregate(pipeline);
      // Updated count query using aggregation to match searchTerm
      const countPipeline: PipelineStage[] = [
         {
            $match: {
               propertyId: propertyId,
               ...reservationFilter,
               ...privilegeFilter,
            },
         },
         {
            $lookup: {
               from: 'users',
               localField: 'userId',
               foreignField: '_id',
               pipeline: [{ $match: userFilter }],
               as: 'userDetails',
            },
         },
         {
            $unwind: {
               path: '$userDetails',
               preserveNullAndEmptyArrays: false,
            },
         },
         { $count: 'totalCount' },
      ];

      const countResult = await Reservation.aggregate(countPipeline);
      const count = countResult.length > 0 ? countResult[0].totalCount : 0;

      // Format pagination response
      const pages = formatPaginationResponse(reservations[0], count, pagesAttr);
      const result = {
         pagination: pages?.['pagination'],
         ...pages?.['result'],
         propertyDetails,
      };

      res.json(result);
   } catch (err) {
      next(err);
   }
}
