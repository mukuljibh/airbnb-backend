import { Request, Response, NextFunction } from 'express';

import { ApiError } from '../../../utils/error-handlers/ApiError';
import { Reservation } from '../../../models/reservation/reservation';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { PipelineStage } from 'mongoose';
export async function getAllUserReservation(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const pagesAttr = res.locals.pagination;
   const { status, sortField = 'createdAt', sortOrder } = req.query;
   const sortDirection = sortOrder === 'desc' ? -1 : 1;
   let statusMatchStage = {};
   if (status !== 'all') {
      if (status === 'complete') {
         statusMatchStage = { status: { $in: ['complete', 'processing'] } };
      } else {
         statusMatchStage = { status };
      }
   }

   // 'open', 'complete', 'processing', 'cancelled'
   try {
      if (
         !['complete', 'cancelled', 'open', 'all'].includes(status as string)
      ) {
         throw new ApiError(
            400,
            'this are valid status complete | cancelled | open | all ',
         );
      }
      const pipeline: PipelineStage[] = [
         {
            $match: {
               isSelfBooked: false,
               ...statusMatchStage,
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
         { $unwind: '$property' },
         {
            $lookup: {
               from: 'users',
               localField: 'property.hostId',
               foreignField: '_id',
               as: 'host',
            },
         },
         { $unwind: '$host' },
         {
            $lookup: {
               from: 'billings',
               localField: '_id',
               foreignField: 'reservationId',
               as: 'billing',
            },
         },
         { $unwind: { path: '$billing', preserveNullAndEmptyArrays: true } },
         {
            $project: {
               _id: 0,
               reservationId: '$_id',
               property: {
                  id: '$property._id',
                  title: '$property.title',
                  thumbnail: '$property.thumbnail',
                  hostDetails: {
                     id: '$host._id',
                     firstName: '$host.firstName',
                     lastName: '$host.lastName',
                  },
               },
               billing: 1,
               status: 1,
               checkInDate: 1,
               checkOutDate: 1,

               createdAt: 1,
            },
         },
      ];
      if (sortField === 'pricePerNight' || sortField === 'numberOfNights') {
         const sortKey = `billing.${sortField}`;
         pipeline.push({ $sort: { [sortKey]: sortDirection } });
      }
      pipeline.push(
         { $skip: pagesAttr.startIndex },
         { $limit: pagesAttr.limit },
      );
      const results = await Reservation.aggregate(pipeline);
      const totalCount = await Reservation.countDocuments({
         ...statusMatchStage,
      });

      const result = formatPaginationResponse(results, totalCount, pagesAttr);
      res.status(200).json(result);
   } catch (err) {
      next(err);
   }
}
