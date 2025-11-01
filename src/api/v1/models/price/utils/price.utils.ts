import axios from 'axios';
import { checkPromoValidForUser } from '../../../controllers/general/reservation/services/payment.service';
import { PromoCode } from '../../promo-code/promoCode';
import cache from '../../../config/cache';
import mongoose from 'mongoose';
import moment from 'moment';

export function calculateFee(rule, personCount, basePrice) {
   if (personCount <= rule.limit) {
      return 0;
   }
   const headCount = personCount - rule.limit;
   switch (rule.type) {
      case 'fixed':
         return rule.value;
      case 'percentage':
         return (basePrice * rule.value) / 100;
      case 'per_person':
         return headCount * rule.value;
      default:
         return 0;
   }
}

export function calculateServiceFees(
   rules,
   childCount,
   adultCount,
   baseServiceFees,
) {
   let fees = 0;
   fees += calculateFee(rules.adult, adultCount, baseServiceFees);
   fees += calculateFee(rules.child, childCount, baseServiceFees);
   const total = baseServiceFees + fees;

   return total
}

export function isWeekend(date: Date) {
   const day = date.getDay();
   return day === 6 || day == 0;
}

export function calculateNights(checkIn: Date, checkOut: Date) {
   const checkInTime = checkIn.getTime();
   const checkOutTime = checkOut.getTime();
   return Math.ceil((checkOutTime - checkInTime) / (1000 * 60 * 60 * 24));
}
export async function calculatePromoDiscount(
   userId: string,
   basePrice: number,
   discounts: {
      totalDiscount: number;
      discountBreakdown: {
         lengthDiscount: number;
         promoCodeDiscount: number;
      };
   },
   promoCode: string,
   currency: string,
) {
   const { rate, targetCurrency } = await getCurrencyWiseRate(currency)

   const code = await PromoCode.findOne({ promoCode: promoCode.toUpperCase() });
   let { totalDiscount } = discounts;
   const { discountBreakdown } = discounts;
   let promoCodeDiscount;

   if (code) {
      const totalBasePriceAfterAllDiscountSoFar =
         basePrice - totalDiscount || 0;

      const couponValidity = await code.validatePromoCode(totalBasePriceAfterAllDiscountSoFar, currency);

      const maximumDiscount = code.maximumDiscount * rate

      if (!couponValidity.isValid) {
         return {
            totalDiscount,
            discountBreakdown,
         }
      }
      // Ensure promo code is valid before proceeding
      let { discountType, discountValue } = code;

      if (discountType === "flat") {
         discountValue *= rate

      }

      const isPromoValidForUser = await checkPromoValidForUser(
         code._id,
         userId,
         code.maxPerUser,
      );
      if (!isPromoValidForUser.isValid) {
         return {
            totalDiscount,
            discountBreakdown,
         }
      }
      promoCodeDiscount = 0;

      switch (discountType) {

         case 'percentage': {
            promoCodeDiscount =
               (totalBasePriceAfterAllDiscountSoFar * discountValue) /
               100;
            if (promoCodeDiscount > maximumDiscount) {
               promoCodeDiscount = maximumDiscount
            }
            break;
         }

         case 'flat': {
            promoCodeDiscount =
               discountValue >= totalBasePriceAfterAllDiscountSoFar
                  ? totalBasePriceAfterAllDiscountSoFar
                  : discountValue;
            break;
         }
      }

      // Add promo code discount separately 
      totalDiscount += promoCodeDiscount

      discountBreakdown.promoCodeDiscount = promoCodeDiscount;


   }

   return {
      totalDiscount,
      discountBreakdown,
      promoApplied: code
         ? {
            promoCodeId: code._id,
            promoCode: code.promoCode,
            discountType: code.discountType,
            baseDiscountValue: code.discountValue,
            currencyExchangeRate: {
               rate: rate,
               baseCurrency: code.currency,
               targetCurrency: targetCurrency,
               timestamp: new Date()
            },
         }
         : null,
   };
}

export async function getCurrencyWiseRate(targetCurrency = "INR", baseCurrency = "USD") {
   const currencyFromApi = await getApiCurrency(baseCurrency)

   const currencyRates = currencyFromApi?.[baseCurrency.toLowerCase()]

   const rate = currencyRates?.[targetCurrency.toLowerCase()]

   return { rate, targetCurrency }
}

export async function getApiCurrency(baseCurrency: string) {
   const lowerBaseCurrency = baseCurrency.toLowerCase()

   let currencyRates;

   const cacheKey = `${lowerBaseCurrency}`

   const cachedData: { data?: object } | null = getCachedData(cacheKey)

   if (cachedData) {
      currencyRates = cachedData
   }

   else {
      try {
         const formattedDate = moment.utc(new Date()).format("YYYY-MM-DD")

         const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${formattedDate}/v1/currencies/${lowerBaseCurrency}.json`;

         const results = await axios.get(url)

         currencyRates = results.data

         if (currencyRates) {
            cache.set(cacheKey, currencyRates)
         }
      }
      catch (err) {
         throw new Error(err)
      }
   }

   return currencyRates
}
function getCachedData(key) {
   const data = cache.get(key)
   if (!data) {
      return null
   }
   return data
}


export function convertAllKeysIntoCurrency<
   T extends object,
   K extends keyof any
>(
   data: T,
   pickKeys: K[],
   rate: number,
   mode: "round" | "fixed" | "none" = "none"
) {
   const result: Partial<Record<string, number>> = {};

   if (typeof data !== "object" || data === null) return result;

   function helper(obj: any) {
      for (const [key, value] of Object.entries(obj)) {
         if (typeof value === "object" && value !== null) {
            helper(value);
         } else if (pickKeys.includes(key as K) && typeof value === "number") {
            let res;
            if (mode === "fixed") {
               res = parseFloat((value * rate).toFixed(2));
            } else if (mode === "round") {
               res = Math.round(value * rate);
            } else {
               res = value * rate;
            }
            result[key] = res
         }
      }
   }

   helper(data);

   return result;
}

export async function normalizeCurrencyPayload
   <
      T extends object,
      K extends keyof any
   >
   (data: T, pickKeys: K[], hostCurrency: string, guestCurrency: string, mode: "round" | "fixed" | "none" = "none") {

   const rates = await getApiCurrency("usd");

   hostCurrency = hostCurrency.toLowerCase()

   guestCurrency = guestCurrency.toLowerCase()

   const exchangeRates = rates["usd"];

   const usdTohostCurencyRate = exchangeRates[hostCurrency]

   const usdToGuestCurrencyRate = exchangeRates[guestCurrency]

   //host currency -----> guest currency
   const rate = usdToGuestCurrencyRate / usdTohostCurencyRate

   const guestRequestCurrencyPayload = convertAllKeysIntoCurrency(data, pickKeys, rate, mode)

   return { guestRequestCurrencyPayload, rate }
}

export function normalizePrecision<
   T extends Record<string, any>,
>(
   data: T,
   mode: "round" | "fixed" | "none" = "none",
   omitKeys?: string[],
   currency?: string
): T {
   const result: any = {};

   if (typeof data !== "object" || data === null) return data;

   for (const [key, value] of Object.entries(data)) {
      if (!omitKeys?.includes(key) && !mongoose.isValidObjectId(value) && typeof value === "object" && value !== null && !(value instanceof Date)) {
         result[key] = normalizePrecision(value, mode, omitKeys, currency);
      } else if (typeof value === "number") {
         let res;
         if (mode === "fixed") {
            res = parseFloat((value).toFixed(2));
         } else if (mode === "round") {
            res = Math.round(value);
            if (currency?.toUpperCase() == 'UGX' && value > 100) {
               res = Math.round(value / 100) * 100;
            }
         } else {
            res = value;
         }
         result[key] = res;
      } else {
         result[key] = value;
      }
   }

   return result;
}
