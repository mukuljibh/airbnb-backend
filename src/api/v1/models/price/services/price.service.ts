import moment from "moment";
import { IPricing } from "../types/price.model.type";
import { isWeekend } from "date-fns";
import * as priceHelper from '../helper/price.helper'
import { PromoCode } from "../../promo-code/promoCode";
import { checkPromoValidForUser } from "../../../controllers/general/reservation/services/payment.service";
import { zeroDecimalCurrencies } from "../../../constant/currency.constant";


interface PricingDetails {
    userId: string;
    basePrice: number;
    discounts: {
        totalDiscount: number;
        discountBreakdown: Partial<{
            lengthDiscount: number;
            promoCodeDiscount: number;
            lengthDiscountPercentage: number;

        }>
    };
    promoCode: string;
    currency: string;
}


interface BookingRequest {
    checkIn: Date;
    checkOut: Date;
    childCount: number;
    adultCount: number;
    userId: string | null
    promoCode: string | null
    guestRequestedCurrency?: string;
}

export function createPriceService(price: IPricing) {

    const { calculateFee, calculateNights, normalizeCurrencyPayload, normalizePrecision, getCurrencyWiseRate } = priceHelper

    function calculateServiceFees(
        rules,
        childCount,
        adultCount,
        baseServiceFees,
    ) {
        let fees = 0;
        fees += calculateFee({ rule: rules.adult, personCount: adultCount, baseServiceFees });
        fees += calculateFee({ rule: rules.child, personCount: childCount, baseServiceFees });
        const total = baseServiceFees + fees;
        return total
    }

    function calculateBasePrice(
        checkIn: Date,
        checkOut: Date,
        basePrice: number,
        conversionRate: number
    ) {
        let totalBasePrice = 0;

        const currentDate = new Date(checkIn);
        while (currentDate < checkOut) {
            let dailyRate = basePrice

            const dailyRateOverride = price?.dailyRates?.find((rate) => {
                const overideStartDate = moment.utc(new Date(rate.startDate)).startOf('day').toDate()
                const overideEndDate = moment.utc(new Date(rate.endDate)).startOf('day').toDate()
                return currentDate >= overideStartDate && currentDate < overideEndDate
            }
            );
            if (dailyRateOverride) {
                dailyRate = (dailyRateOverride.price * conversionRate);
            }

            // Apply weekend multiplier
            if (isWeekend(currentDate)) {
                dailyRate *= price?.weekendMultiplier || 1;
            }
            // Checking here for seasonal rates
            price?.seasonalRates.forEach((season) => {
                if (currentDate >= season.startDate && currentDate <= season.endDate) {
                    console.log(season);
                    dailyRate *= season.multiplier;
                }
            });

            //added 1.2x or more as per entry each special day
            if (price.specialDates) {
                price.specialDates.forEach((special) => {
                    if (currentDate.toDateString() === special.date.toDateString()) {
                        console.log('special date');

                        dailyRate *= special.multiplier;
                    }
                });
            }
            totalBasePrice += dailyRate;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return { totalBasePrice }

    }

    function calculateDiscount(basePrice: number, numberOfNights: number) {
        let totalDiscount = 0;
        const discountBreakdown: Partial<{ lengthDiscount: number; promoCodeDiscount: number; lengthDiscountPercentage: number; }> = {

        };

        // Length of stay discount
        // give best discount
        const applicableLengthDiscount = price.lengthDiscounts
            .filter((discount) => numberOfNights >= discount.minNights)
            .sort((a, b) => b.discount - a.discount)[0];

        if (applicableLengthDiscount) {
            const lengthDiscountPercentage = (applicableLengthDiscount?.discount || 0) / 100;
            const lengthDiscountAmount = basePrice * lengthDiscountPercentage;
            if (lengthDiscountAmount > 0) {
                totalDiscount += lengthDiscountAmount;
                discountBreakdown.lengthDiscount = lengthDiscountAmount;
            }
        }

        return {
            totalDiscount: totalDiscount,
            discountBreakdown,
            lengthDiscountPercentage: applicableLengthDiscount?.discount,
        };
    }

    async function calculatePromoDiscount(options: PricingDetails) {

        const { basePrice, currency, discounts, promoCode, userId } = options

        if (!(promoCode && userId)) {
            return { ...discounts, promoApplied: null }
        }
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
            let { discountValue } = code;
            const { discountType } = code

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
                    promoApplied: null
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

    async function calculateTotalPrice(options: BookingRequest) {

        const { checkIn, checkOut, adultCount, childCount, promoCode, userId, guestRequestedCurrency } = options
        const original = {
            basePrice: price.basePrice,
            additionalFees: price.additionalFees
        };

        const hostCurrency = price.basePrice.currency

        const keysToConvert = ['amount', 'service', 'cleaning'];

        const { guestRequestCurrencyPayload, rate } = await normalizeCurrencyPayload(original, keysToConvert, hostCurrency, guestRequestedCurrency)

        const { amount: convertedBaseAmount } = guestRequestCurrencyPayload;
        let { service: convertedServiceFees, cleaning: convertedCleaningFees } = guestRequestCurrencyPayload;

        convertedServiceFees = convertedServiceFees || 0
        convertedCleaningFees = convertedCleaningFees || 0

        const numberOfNights = calculateNights(checkIn, checkOut);

        const { totalBasePrice: totalbasePrice } = calculateBasePrice(checkIn, checkOut, convertedBaseAmount, rate);

        const averageBasePrice = totalbasePrice / numberOfNights

        const discounts = calculateDiscount(totalbasePrice, numberOfNights);

        const lengthDiscountPercentage = discounts?.lengthDiscountPercentage;

        // if (promoCode && userId) {
        const finalDiscount = await calculatePromoDiscount(
            {
                userId,
                basePrice: totalbasePrice,
                discounts,
                promoCode,
                currency: guestRequestedCurrency
            },
        )


        const { totalDiscount, discountBreakdown } = finalDiscount

        const priceAfterDiscounts = totalbasePrice - totalDiscount

        const { lengthDiscount, promoCodeDiscount } = discountBreakdown


        const serviceFeeAsPerRule = calculateServiceFees(
            price.capacityFeesRules,
            childCount,
            adultCount,
            convertedServiceFees
        )

        const totalFeesApplicable = convertedCleaningFees + serviceFeeAsPerRule

        const subTotal =
            (totalbasePrice -
                (lengthDiscount ?? 0)) +
            (totalFeesApplicable ?? 0);



        //14 percent charge on subtotal
        const platformFees = subTotal * 0.14

        //tax charge 18 percent on subTotal
        const taxAmount = subTotal * 0.18

        const totalPrice = (subTotal + taxAmount + platformFees) - (promoCodeDiscount ?? 0)

        //round the final answer when zero decimal currency is selected otherwise two decimal number will be displayed
        const mode: "fixed" | "round" = zeroDecimalCurrencies.includes(guestRequestedCurrency.toUpperCase()) ? "round" : "fixed"


        const resultPayload = {
            selectedDates: {
                checkIn,
                checkOut,
            },
            guest: {
                child: childCount,
                adult: adultCount,
            },
            numberOfNights,
            pricePerNight: averageBasePrice,
            totalbasePrice,
            additionalFees: {
                cleaning: convertedCleaningFees,
                service: serviceFeeAsPerRule,
                tax: taxAmount,
                platformFees
            },
            discounts: finalDiscount?.totalDiscount,
            discountBreakdown: finalDiscount?.discountBreakdown,
            promoApplied: finalDiscount?.promoApplied,
            currencyExchangeRate: {
                rate: rate,
                baseCurrency: price.basePrice.currency.toLowerCase(),
                targetCurrency: guestRequestedCurrency,
                timestamp: new Date()
            },
            lengthDiscountPercentage,
            taxPercentage: 18,
            priceAfterDiscounts,
            subTotal,
            totalPrice,
            currency: guestRequestedCurrency
        };

        const result = normalizePrecision(resultPayload, mode, ['currencyExchangeRate'], guestRequestedCurrency)
        return result
    }

    return {
        calculateTotalPrice
    }
}

