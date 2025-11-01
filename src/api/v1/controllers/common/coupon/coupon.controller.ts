import { Request, Response, NextFunction } from 'express';
import { PromoCode } from '../../../models/promo-code/promoCode';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { checkPromoValidForUser } from '../../general/reservation/services/payment.service';
import { promoCodeTemplate } from '../../../models/promo-code/utils/promo.utils';
import { convertAllKeysIntoCurrency, getCurrencyWiseRate } from '../../../models/price/utils/price.utils';
import getSymbolFromCurrency from 'currency-symbol-map'
import { zeroDecimalCurrencies } from '../../../constant/currency.constant';
import { User } from '../../../models/user/user';


export async function applyPromo(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const currency = res.locals.currency
   const { rate } = await getCurrencyWiseRate(currency)
   const todayDate = new Date();
   todayDate.setUTCHours(0, 0, 0, 0);
   try {
      const user = req.user
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

      const sessionUser = await User.findById(user._id).select('status')

      if (sessionUser.status === "suspended") {
         throw new ApiError(
            409,
            'Your account is currently suspended. Please contact our support team for assistance.'
         )
      }

      let rawPromo = await PromoCode.findOne({
         promoCode: promoCode,
         status: 'active',
         validFrom: { $lte: todayDate },
         validUntil: { $gte: todayDate },
         $expr: { $lt: ['$usedCount', '$maxRedemptions'] },
      }).select('discountValue discountType minimumSpend maximumDiscount promoCode currency maxPerUser')

      if (!rawPromo) {
         {
            throw new ApiError(400, 'Invalid Promo code');
         }
      }
      const checkPromo = await rawPromo.validatePromoCode(totalbasePrice, currency);
      if (!checkPromo.isValid) {
         throw new ApiError(400, checkPromo.message);
      }

      const isPromoValidForUser = await checkPromoValidForUser(
         rawPromo._id,
         user._id,
         rawPromo.maxPerUser,
      );

      if (!isPromoValidForUser.isValid) {
         throw new ApiError(400, isPromoValidForUser.message);
      }

      const { discountValue, minimumSpend, maximumDiscount } = convertAllKeysIntoCurrency(rawPromo, ['discountValue', 'minimumSpend', 'maximumDiscount'], rate)

      const promo = {
         ...(rawPromo.toObject()),
         minimumSpend: minimumSpend,
         maximumDiscount,
         discountValue: rawPromo.discountType === "flat" ? discountValue : rawPromo.discountValue
      }
      return res.json(
         new ApiResponse(200, 'Promo code applied successfully', {
            isValid: checkPromo.isValid,
            promo,
         }),
      );
   } catch (err) {
      console.log(err);
      return next(err);
   }
}

export async function getAllPromos(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {

      const guestRequestedCurrency = res.locals.currency
      const { rate } = await getCurrencyWiseRate(guestRequestedCurrency)
      const currencyCode = getSymbolFromCurrency(guestRequestedCurrency)

      const todayDate = new Date();
      todayDate.setUTCHours(0, 0, 0, 0);
      const rawCodes = await PromoCode.find({
         status: 'active',
         validFrom: { $lte: todayDate },
         validUntil: { $gte: todayDate },
         $expr: { $lt: ['$usedCount', '$maxRedemptions'] },
      }).select('promoCode minimumSpend maximumDiscount validUntil discountValue discountValue discountType eligibleUserTypes').lean();

      let mode: "fixed" | "round" = zeroDecimalCurrencies.includes(guestRequestedCurrency) ? "round" : "fixed"
      const promoCodes = rawCodes.map((code) => {
         const { discountValue, minimumSpend, maximumDiscount } = convertAllKeysIntoCurrency(code, ['discountValue', 'minimumSpend', 'maximumDiscount'], rate, mode)
         const promoData = {
            promoCode: code.promoCode,
            amount: code.discountType === "flat" ? discountValue : code.discountValue,
            symbol: currencyCode,
            discountType: code.discountType,
            date: code.validUntil,
            minimumSpend,
            maximumDiscount,
            eligibleUserTypes: code.eligibleUserTypes
         };
         const description = promoCodeTemplate(promoData)
         return { ...promoData, description: description.trim() }
      })

      res.status(200).json(
         new ApiResponse(200, 'Promo codes fetched successfully.', promoCodes),
      );
   } catch (err) {
      next(err);
   }
}
