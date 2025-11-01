import { ApiError } from "../../../../utils/error-handlers/ApiError";

function getStripeMaxAmount(currency) {
    const limits = {
        DEFAULT: { decimals: 2, maxDigits: 8 },

        INR: { decimals: 2, maxDigits: 9 },
        IDR: { decimals: 2, maxDigits: 12, note: "9 digits with Amex only" },
        LBP: { decimals: 0, maxDigits: 11 },
        COP: { decimals: 1, maxDigits: 10 },
        HUF: { decimals: 0, maxDigits: 10 },
        JPY: { decimals: 0, maxDigits: 10, note: "8 digits with JCB/Diners/Discover in Japan" },
    };

    const info = limits[currency.toUpperCase()] || limits.DEFAULT;

    const maxSmallestUnit = BigInt("9".repeat(info.maxDigits));

    return {
        currency: currency.toUpperCase(),
        decimals: info.decimals,
        maxDigits: info.maxDigits,
        maxSmallestUnit,
        note: info.note,
    };
}

export function validateStripeAmount(total, currency) {
    const { maxSmallestUnit, decimals, note } = getStripeMaxAmount(currency);

    const smallestUnitTotal = BigInt(total);

    // const smallestUnitTotal = BigInt(Math.round(total * 10 ** decimals));
    if (smallestUnitTotal > maxSmallestUnit) {
        throw new ApiError(
            409,
            `The entered amount exceeds the maximum allowed limit for ${currency}. 
        Maximum permitted: ${Number(maxSmallestUnit) / 10 ** decimals} ${currency}${note ? ` (${note})` : ""}.`
        );
    }

    return true;
}
