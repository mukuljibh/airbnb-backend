import { Request, Response, NextFunction } from 'express';
import { PromoCode } from '../../../models/promo-code/promoCode';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import mongoose, { ClientSession, PipelineStage } from 'mongoose';
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
      discountType,
      discountValue,
      validFrom,
      validUntil,
      minimumSpend,
      eligibleUserTypes,
      maxRedemptions,
      maximumDiscount,
      maxPerUser,
   } = req.body;
   try {
      await PromoCode.create({
         promoCode,
         discountType,
         discountValue,
         validFrom,
         validUntil,
         minimumSpend,
         eligibleUserTypes,
         maxRedemptions,
         maximumDiscount,
         maxPerUser,
      });

      return res.json(new ApiResponse(201, 'promo code created successfully.'));
   } catch (err) {
      if (err.code == 11000) {
         const duplicateField = Object.keys(err.keyValue)[0];
         const duplicateValue = err.keyValue[duplicateField];
         throw new ApiError(409, `A coupon with ${duplicateField} "${duplicateValue}" already exists. Please choose a different promo code.`)
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
      const { status } = req.query;

      const { search, sort, pagination } = res.locals
      const { sortDirection, sortField } = sort
      const { searchTerm } = search
      const sortBy = sortField || 'createdAt';

      if (
         status &&
         !['active', 'expired', 'inactive', 'all'].includes(status as string)
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
         { $skip: pagination.startIndex },
         { $limit: pagination.limit },
      );


      const countPipeline = pipeline
         .filter(
            (stage) =>
               !('$skip' in stage || '$limit' in stage || '$sort' in stage),
         )
         .concat({ $count: 'total' });

      const [promoCodes, countResult] = await Promise.all([
         PromoCode.aggregate(pipeline),
         PromoCode.aggregate(countPipeline)
      ])

      const totalPromoCount = countResult[0]?.total || 0;

      const result = formatPaginationResponse(
         promoCodes,
         totalPromoCount,
         pagination,
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
         throw new ApiError(400, 'No promocode found to toggle');
      }
      if (promoCode.status == status) {
         throw new ApiError(400, `promocode already set as ${status}`);
      }
      promoCode.status = status;
      await promoCode.save();
      return res
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
   let session: ClientSession | null;
   try {
      const promoId = validateObjectId(req.params.promoId);

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
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
         await PromoCode.findByIdAndUpdate(
            promoId,
            requestedFieldsToUpdate,
         ).session(session);
      });

      return res
         .status(200)
         .json(new ApiResponse(200, 'Promo code updated successfully.'));
   } catch (err) {
      next(err);
   } finally {
      if (session) await session.endSession();
   }
}
