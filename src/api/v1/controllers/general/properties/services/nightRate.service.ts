import moment from "moment"
import { normalizeCurrencyPayload } from "../../../../models/price/utils/price.utils";




export async function caculateNightlyRate(properties: any[], guestRequestedCurrency) {
    const today = moment.utc(new Date()).startOf("day").toDate();

    for (let prop of properties) {
        const reservation = prop?.reservations || [];



        let startDate = today;
        let endDate = reservation.at(-1)?.checkOutDate || moment.utc(startDate).add(2, "days").toDate();

        let dates = {
            _id: prop._id,
            startDate,
            end: endDate,
            nights: 2
        };

        let signal = false
        if (!reservation || reservation.length == 0) {
            signal = true
        }


        // run upto the bound
        while (startDate < endDate && !signal) {
            let loopBreak = false;
            let end = moment.utc(startDate).add(2, "days").toDate();

            for (let res of reservation) {
                const cond = startDate < res?.checkOutDate && end > res?.checkInDate;

                if (cond) {
                    startDate = res.checkOutDate;
                    end = moment.utc(startDate).add(2, "days").toDate();
                }
                dates = {
                    startDate, end, nights: 2, _id: prop._id
                };
                loopBreak = true;
                break;
            }

            if (loopBreak) break;

            startDate.setDate(startDate.getDate() + 1);
        }

        const dailyRates = prop.realPrice?.dailyRates || []
        const price = prop.realPrice?.price

        const { guestRequestCurrencyPayload, rate: conversionRate } =
            await normalizeCurrencyPayload(price, ['amount'], price.currency, guestRequestedCurrency)

        // console.log({ guestRequestCurrencyPayload });

        const newStart = new Date(dates.startDate)
        const newEnd = new Date(dates.end)


        let accPrice = 0

        while (newStart < newEnd) {
            let dailyRate = accPrice

            const dailyRateOverride = dailyRates?.find((rate) => {
                const overideStartDate = moment.utc(new Date(rate.startDate)).startOf('day').toDate()
                const overideEndDate = moment.utc(new Date(rate.endDate)).startOf('day').toDate()
                return newStart >= overideStartDate && newStart < overideEndDate
            }
            );

            dailyRate = guestRequestCurrencyPayload.amount
            if (dailyRateOverride) {
                dailyRate = (dailyRateOverride.price * conversionRate);
            }
            accPrice += dailyRate;
            newStart.setDate(newStart.getDate() + 1);
        }


        console.log({ ...dates, accPrice });
    }
} 
