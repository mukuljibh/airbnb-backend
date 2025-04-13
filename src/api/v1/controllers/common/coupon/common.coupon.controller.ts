import { Request, Response, NextFunction } from 'express';
import { PromoCode } from '../../../models/promo-code/promoCode';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { checkPromoValidForUser } from '../../general/reservation/utils/general.reservation.utils';

export async function applyPromo(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const todayDate = new Date();
   todayDate.setUTCHours(0, 0, 0, 0);
   try {
      const user = req.user as ISessionUser;
      const {
         promoCode,
         totalbasePrice,
      }: { promoCode: string; totalbasePrice: number } = req.body;
      if (typeof promoCode !== 'string' || !promoCode.trim()) {
         throw new ApiError(400, 'A valid promo code is required.');
      }

      if (
         typeof totalbasePrice !== 'number' ||
         isNaN(totalbasePrice) ||
         totalbasePrice <= 0
      ) {
         throw new ApiError(
            400,
            'A valid totalbasePrice must be a positive number.',
         );
      }

      const promo = await PromoCode.findOne({
         promoCode: promoCode,
         status: 'active',
         validFrom: { $lte: todayDate },
         validUntil: { $gte: todayDate },
         $expr: { $lt: ['$usedCount', '$maxRedemptions'] },
      });

      if (!promo) {
         {
            throw new ApiError(400, 'Invalid promoCode');
         }
      }
      const checkPromo = await promo.validatePromoCode(totalbasePrice);
      if (!checkPromo.isValid) {
         throw new ApiError(500, checkPromo.message);
      }
      const isPromoValidForUser = await checkPromoValidForUser(
         promo._id,
         user._id,
         promo.maxPerUser,
      );

      if (!isPromoValidForUser.isValid) {
         throw new ApiError(400, isPromoValidForUser.message);
      }
      res.status(200).json(
         new ApiResponse(200, 'Promo code fetched successfully', {
            isValid: checkPromo.isValid,
            promo,
         }),
      );
   } catch (err) {
      next(err);
   }
}

export async function getAllPromos(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const todayDate = new Date();
      todayDate.setUTCHours(0, 0, 0, 0);
      const promoCodes = await PromoCode.find({
         status: 'active',
         validFrom: { $lte: todayDate },
         validUntil: { $gte: todayDate },
         $expr: { $lt: ['$usedCount', '$maxRedemptions'] },
      }).select('promoCode description validFrom validUntil minimumSpend');

      res.status(200).json(
         new ApiResponse(200, 'Promo codes fetched successfully.', promoCodes),
      );
   } catch (err) {
      next(err);
   }
}
