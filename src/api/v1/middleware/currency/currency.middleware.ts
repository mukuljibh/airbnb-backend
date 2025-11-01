import { Request, Response, NextFunction } from "express"
import geoip from 'geoip-lite'
import countryToCurrency from "country-to-currency";

export function placeCurrencyIntoRequest(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip;
    const geo = geoip.lookup(ip);
    //get country code based on client ip address
    const country = geo?.country || 'IN';
    //get default currency code based on country code from geo ip 
    const defaultCurrency = countryToCurrency[country]

    const acceptLanguage = req.headers['accept-language'];
    let language = 'en';

    if (acceptLanguage) {
        language = acceptLanguage.split(',')[0].split('-')[0];
    }

    const locale = `${language}-${country}`;
    res.locals.locale = locale;

    const currency = req.headers?.['x-currency'] as string

    res.locals.currency = currency?.toLowerCase() || defaultCurrency?.toLowerCase() || "usd";

    next();
}


