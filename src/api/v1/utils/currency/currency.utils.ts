
import axios from "axios";
import countryToCurrency from "country-to-currency";
import getSymbolFromCurrency from "currency-symbol-map";
import env from "../../config/env";

export async function getCountryCodeFromGoogleAPI(query: string) {
    try {
        const externalLink = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${env.GOOGLE_MAPS_API_KEY}`
        const results = await axios.get(externalLink)
        const countryComponent = results?.data?.results[0]?.address_components?.find(comp =>
            comp.types.includes("country")
        );
        const countryCode = countryComponent?.short_name;
        return countryToCurrency[countryCode] || "USD"
    }
    catch (err) {
        console.log("error getting currency code from google map api : ", err);
        throw new Error("invalid country")
    }
}


export function concatCurrencyWithPrice(currency: string, price: number) {

    const symbol = getSymbolFromCurrency(currency?.toLowerCase())

    return `${symbol}${price}`
}

