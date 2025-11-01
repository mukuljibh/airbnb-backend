import { Request, Response, NextFunction } from 'express';
import { Reservation } from '../../../models/reservation/reservation';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import mongoose, { PipelineStage } from 'mongoose';
import { Transaction } from '../../../models/reservation/transaction';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import * as commonReservationUtils from '../../common/reservation/services/reservation.service';
import { Property } from '../../../models/property/property';

export async function getAllTransactions(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { pagination, search, sort } = res.locals;

   const { sortDirection, sortField } = sort
   const { searchTerm } = search

   const { transactionType, status } =
      req.query as {
         transactionType: string;
         status: string;
      };


   const searchFilters: Record<string, unknown> = {};
   if (searchTerm) {
      const regex = { $regex: searchTerm, $options: 'i' };
      const fieldsToSearch = [
         'guestDetails.fullName',
         'guestDetails.email',
         'transactionCode',
         'guestDetails.phone.number'
      ];
      searchFilters.$or = fieldsToSearch.map((field) => ({
         [field]: regex,
      }));
   }

   const mainFilters: Record<string, unknown> = {
      type: transactionType,
      paymentStatus: { $ne: 'open' },
   };
   if (status != 'all') {
      mainFilters.paymentStatus = status;
   }
   try {

      const pipeline: PipelineStage[] = []

      pipeline.push({
         $match: mainFilters,
      })

      const sortMap = {
         status: 'paymentStatus',
         firstName: 'guestDetails.firstName',
         createdAt: 'createdAt',
      };
      if (['createdAt', 'paymentStatus'].includes(sortField)) {
         pipeline.push({
            $sort: { [sortMap[sortField]]: sortDirection }
         });
      }




      pipeline.push(

         {
            $lookup: {
               from: 'billings',
               localField: 'billingId',
               foreignField: '_id',
               pipeline: [
                  {
                     $project: {
                        pricePerNight: 1,
                        totalPrice: 1,
                        totalAmountPaid: 1,
                        remainingAmount: 1,
                        hasRefunds: 1,
                        totalRefunded: 1,
                     },
                  },
               ],
               as: 'billing',
            },
         },
         {
            $unwind: {
               path: '$billing',
               preserveNullAndEmptyArrays: false,
            },
         },
         {
            $lookup: {
               from: 'reservations',
               localField: 'reservationId',
               foreignField: '_id',
               pipeline: [
                  {
                     $project: {
                        userId: 1,
                        status: 1,
                     },
                  },
               ],
               as: 'reservation',
            },
         },
         {
            $unwind: {
               path: '$reservation',
               preserveNullAndEmptyArrays: false,
            },
         },
         {
            $lookup: {
               from: 'users',
               localField: 'reservation.userId',
               foreignField: '_id',
               pipeline: [
                  {
                     $addFields: {
                        fullName: { $concat: ['$firstName', ' ', '$lastName'] }
                     }
                  },
                  {
                     $project: {
                        _id: 0,
                        email: 1,
                        phone: 1,
                        fullName: 1,
                        firstName: 1,
                        lastName: 1,
                     },
                  },
               ],
               as: 'guestDetails',
            },
         },
         {
            $unwind: {
               path: '$guestDetails',
               preserveNullAndEmptyArrays: false,
            },
         },
         { $match: searchFilters },
      );

      if (sortField) {
         if (sortField === "firstName") {
            pipeline.push({
               $sort: { [sortMap[sortField]]: sortDirection },
            });
         }
      }
      pipeline.push(
         { $skip: pagination.startIndex },
         { $limit: pagination.limit }
      );
      pipeline.push({
         $project: {
            _id: 0,
            transactionCode: 1,
            paymentIntentId: 1,
            paymentMethod: 1,
            stripeTransactionId: 1,
            paymentAmount: 1,
            stripeRefundId: 1,
            paymentStatus: 1,
            receiptUrl: 1,
            type: 1,
            createdAt: 1,
            updatedAt: 1,
            billing: 1,
            reservation: 1,
            guestDetails: 1,
         },
      });

      const countPipeline: PipelineStage[] = [
         {
            $match: mainFilters,
         },
         {
            $lookup: {
               from: 'reservations',
               localField: 'reservationId',
               foreignField: '_id',
               pipeline: [
                  {
                     $project: {
                        userId: 1,
                     },
                  },
               ],
               as: 'reservation',
            },
         },
         {
            $unwind: {
               path: '$reservation',
               preserveNullAndEmptyArrays: false,
            },
         },
         {
            $lookup: {
               from: 'users',
               localField: 'reservation.userId',
               foreignField: '_id',
               pipeline: [
                  {
                     $addFields: {
                        fullName: { $concat: ['$firstName', ' ', '$lastName'] }
                     }
                  },
                  {
                     $project: {
                        _id: 0,
                        email: 1,
                        phone: 1,
                        fullName: 1,
                     },
                  },
               ],
               as: 'guestDetails',
            },
         },
         {
            $unwind: {
               path: '$guestDetails',
               preserveNullAndEmptyArrays: false,
            },
         },
         { $match: searchFilters },

         { $count: 'totalCount' },
      ];

      // await getMongoQueryRunTimePlan(Transaction, pipeline)
      const transactionAggregation = Transaction.aggregate(pipeline);
      const countAggregation = Transaction.aggregate(countPipeline);

      const [transactionList, countResult] = await Promise.all([
         transactionAggregation,
         countAggregation,
      ]);
      const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;
      // Format pagination response
      const result = formatPaginationResponse(
         transactionList,
         totalCount,
         pagination,
      );
      return res.json(result);
   } catch (err) {
      return next(err);
   }
}

export async function getEntireReservationsPaymentDetailsById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const filter: Record<string, unknown> = {};
   try {
      const reservationId = validateObjectId(req.params.reservationId);
      const reservation = await Reservation.findOne({ _id: reservationId });

      if (!reservation) {
         throw new ApiError(
            404,
            'No reservation found for requested reservation id',
         );
      }
      filter._id = reservationId;

      const result =
         await commonReservationUtils.getEntireReservationDetailsById(filter);
      res.json(result);
   } catch (err) {
      next(err);
   }
}

export async function getReservationsByFilterForAdmin(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { pagination } = res.locals;

   const filter: Record<string, unknown> = {};
   try {
      let propertyId: string | mongoose.Types.ObjectId = req.params.propertyId;
      if (propertyId) {
         propertyId = validateObjectId(propertyId);
         filter.propertyId = propertyId;
      }

      const [result, propertyDetails] = await Promise.all([
         commonReservationUtils.getFilteredReservations(
            pagination,
            req.query,
            filter,
         ),
         propertyId
            ? Property.findOne({
               _id: propertyId,
            }).select('title')
            : null,
      ]);

      return res.json({
         ...result,
         propertyDetails,
      });
   } catch (err) {
      return next(err);
   }
}
