import { Request, Response, NextFunction } from 'express';
import { PromoCode } from '../../../models/promo-code/promoCode';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import mongoose, { PipelineStage } from 'mongoose';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { deepFilterObject, omit } from '../../../utils/mutation/mutation.utils';
export async function generatePromoCode(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const {
      promoCode,
      description,
      discountType,
      discountValue,
      validFrom,
      validUntil,
      minimumSpend,
      eligibleUserTypes,
      maxRedemptions,
      maxPerUser,
   } = req.body;
   try {
      await PromoCode.create({
         promoCode,
         description,
         discountType,
         discountValue,
         validFrom,
         validUntil,
         minimumSpend,
         eligibleUserTypes,
         maxRedemptions,
         maxPerUser,
      });

      return res
         .status(200)
         .json(new ApiResponse(201, 'promo code created successfully.'));
   } catch (err) {
      if (err.code == 11000) {
         return next(new ApiError(409, 'Coupon code already exist.'));
      }
      next(err);
   }
}
export async function getSinglePromoById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const promoId = validateObjectId(req.params.promoId);
      const promoCode = await PromoCode.findById(promoId).lean();

      return res
         .status(200)
         .json(
            new ApiResponse(200, 'promo code fetched successfully.', promoCode),
         );
   } catch (err) {
      next(err);
   }
}
export async function getAllPromoCodes(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { status, searchTerm, sortField, sortOrder } =
         req.query as Partial<{
            status: string;
            searchTerm: string;
            sortField:
               | 'discountValue'
               | 'validFrom'
               | 'validUntil'
               | 'status'
               | 'discountType'
               | 'promoCode';
            sortOrder: 'asc' | 'desc';
         }>;

      const pagesAttr = res.locals.pagination;
      const sortBy = sortField || 'createdAt';
      const sortDirection = sortOrder === 'asc' ? 1 : -1;

      if (
         status &&
         !['active', 'expired', 'inactive', 'all'].includes(status)
      ) {
         throw new ApiError(
            400,
            'Please provide either active | inactive | expired | all',
         );
      }

      // Build aggregation pipeline
      const pipeline: PipelineStage[] = [
         {
            $addFields: {
               status: {
                  $cond: [
                     { $eq: ['$status', 'inactive'] },
                     'inactive',
                     {
                        $cond: [
                           { $gte: ['$usedCount', '$maxRedemptions'] },
                           'expired',
                           {
                              $cond: [
                                 { $lt: ['$validUntil', new Date()] },
                                 'expired',
                                 'active',
                              ],
                           },
                        ],
                     },
                  ],
               },
            },
         },
      ];

      if (status && status !== 'all') {
         pipeline.push({ $match: { status } });
      }

      if (searchTerm?.trim()) {
         const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         pipeline.push({
            $match: {
               promoCode: { $regex: escapedTerm, $options: 'i' },
            },
         });
      }

      pipeline.push(
         { $sort: { [sortBy]: sortDirection } },
         { $skip: pagesAttr.startIndex },
         { $limit: pagesAttr.limit },
      );

      const promoCodes = await PromoCode.aggregate(pipeline);

      const countPipeline = pipeline
         .filter(
            (stage) =>
               !('$skip' in stage || '$limit' in stage || '$sort' in stage),
         )
         .concat({ $count: 'total' });
      const countResult = await PromoCode.aggregate(countPipeline);
      const totalPromoCount = countResult[0]?.total || 0;

      const result = formatPaginationResponse(
         promoCodes,
         totalPromoCount,
         pagesAttr,
      );
      res.status(200).json(result);
   } catch (err) {
      next(err);
   }
}

export async function togglePromoStatus(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { status } = req.query as { status: 'active' | 'inactive' };
   try {
      const promoId = validateObjectId(req.params.promoId);
      if (!['active', 'inactive'].includes(status)) {
         throw new ApiError(400, 'please provide either active | inactive ');
      }

      const promoCode = await PromoCode.findById(promoId);
      if (!promoCode) {
         throw new ApiError(400, 'No promocode found to update');
      }
      if (promoCode.status == status) {
         throw new ApiError(400, `promocode already set as ${status}`);
      }
      promoCode.status = status;
      await promoCode.save();
      return res
         .status(200)
         .json(
            new ApiResponse(
               200,
               `promo code status changed to ${status} successfully.`,
            ),
         );
   } catch (err) {
      next(err);
   }
}
export async function deletePromoCode(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const couponId = validateObjectId(req.params.promoId);
      const promoCode = await PromoCode.findById(couponId);

      if (!promoCode) {
         throw new ApiError(400, 'No Promocode found to delete');
      }
      if (promoCode.usedCount > 0) {
         throw new ApiError(
            400,
            'Unable to delete this coupon as it is currently associated with active guest reservations.',
         );
      }

      await promoCode.deleteOne();

      return res
         .status(200)
         .json(new ApiResponse(200, 'Promo code deleted successfully.'));
   } catch (err) {
      next(err);
   }
}

export async function updatePromoCode(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   let requestedFieldsToUpdate = deepFilterObject(req.body);
   const session = await mongoose.startSession();
   try {
      const promoId = validateObjectId(req.params.promoId);
      session.startTransaction();

      const targetPromoCode = await PromoCode.findById(promoId);
      if (!targetPromoCode) {
         throw new ApiError(400, 'No promo found to update');
      }

      if (targetPromoCode.usedCount > 0) {
         const restrictedFields = [
            'promoCode',
            'discountType',
            'discountValue',
            'validFrom',
         ];
         const isRestrictedUpdate = Object.keys(requestedFieldsToUpdate).some(
            (field) => restrictedFields.includes(field),
         );

         if (isRestrictedUpdate) {
            requestedFieldsToUpdate = omit(
               requestedFieldsToUpdate,
               ...restrictedFields,
            );
         }
      }
      await PromoCode.findByIdAndUpdate(
         promoId,
         requestedFieldsToUpdate,
      ).session(session);

      await session.commitTransaction();

      return res
         .status(200)
         .json(new ApiResponse(200, 'Promo code updated successfully.'));
   } catch (err) {
      await session.abortTransaction();
      next(err);
   } finally {
      await session.endSession();
   }
}
