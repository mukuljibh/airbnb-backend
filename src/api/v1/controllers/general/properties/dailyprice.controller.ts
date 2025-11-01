import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { Property } from '../../../models/property/property';
import { Price } from '../../../models/price/price';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import moment from 'moment';

export async function postPropertyDailyPrice(req: Request, res: Response, next: NextFunction) {
    try {
        const { startDate, endDate, price } = req.body;
        const propertyId = validateObjectId(req.params.propertyId);
        const user = req.user;

        const property = await Property.findOne({ _id: propertyId, hostId: user._id }).select('price')

        if (!property) {
            throw new ApiError(404, 'No property found');
        }

        const propertyPrice = await Price.findById(property.price);
        if (!propertyPrice) {
            throw new ApiError(404, 'Price record not found');
        }

        const newStart = moment.utc(new Date(startDate)).startOf('date').toDate();
        const newEnd = moment.utc(new Date(endDate)).startOf('date').toDate();

        if (newStart > newEnd) {
            throw new ApiError(400, 'Start date cannot be after end date');
        }

        const isOverlapping = propertyPrice.dailyRates?.some((rate) => {
            const existingStart = moment.utc(new Date(rate.startDate)).startOf('date').toDate();
            const existingEnd = moment.utc(new Date(rate.endDate)).startOf('date').toDate();

            return newStart < existingEnd && newEnd > existingStart;
        });


        if (isOverlapping) {
            throw new ApiError(400, 'Price for the selected date range already exists or overlaps with another range');
        }

        const priceObject = {
            price,
            startDate: newStart,
            endDate: newEnd,
        }
        propertyPrice.dailyRates.push(priceObject);

        propertyPrice.dailyRates.sort((a, b) => {
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });

        propertyPrice.dailyRates = propertyPrice.dailyRates.slice(0, 365);

        await propertyPrice.save();

        return res.json(new ApiResponse(200, 'Daily price added successfully'))

    } catch (err) {
        console.log({ err });

        next(err);
    }
}



export async function updatePropertyDailyPrice(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { startDate, endDate, price } = req.body;
        const dailyPriceId = validateObjectId(req.params.dailyPriceId);
        const propertyId = validateObjectId(req.params.propertyId);

        const user = req.user;

        const property = await Property.findOne({ _id: propertyId, hostId: user._id }).select('price')

        if (!property) {
            throw new ApiError(404, 'No property found');
        }

        const propertyPrice = await Price.findById(property.price);
        if (!propertyPrice) {
            throw new ApiError(404, 'Price record not found');
        }

        const targetRate = (propertyPrice.dailyRates as any).id(dailyPriceId);

        if (!targetRate) {
            throw new ApiError(404, 'Daily price not found');
        }

        const newStart = moment.utc(new Date(startDate)).startOf('date').toDate();
        const newEnd = moment.utc(new Date(endDate)).startOf('date').toDate();

        const hasOverlap = propertyPrice.dailyRates?.some((rate: any) => {
            if (rate._id.toString() === dailyPriceId.toString()) return false;

            const existingStart = moment.utc(new Date(rate.startDate)).startOf('date').toDate();
            const existingEnd = moment.utc(new Date(rate.endDate)).startOf('date').toDate();

            return newStart < existingEnd && newEnd > existingStart;

        });

        if (hasOverlap) {
            throw new ApiError(400, 'The provided date range overlaps with an existing daily rate');
        }

        targetRate.price = price;
        targetRate.startDate = newStart;
        targetRate.endDate = newEnd;

        await propertyPrice.save();

        return res.json(new ApiResponse(200, 'Daily price updated successfully', targetRate))

    } catch (err) {
        console.log({ err });

        next(err);
    }
}



export async function deletePropertyDailyPrice(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const dailyPriceId = validateObjectId(req.params.dailyPriceId);
        const propertyId = validateObjectId(req.params.propertyId);

        const user = req.user;

        const property = await Property.findOne({ _id: propertyId, hostId: user._id }).select('price')
        if (!property) {
            throw new ApiError(404, 'No property found');
        }

        const price = await Price.findById(property.price);
        if (!price) {
            throw new ApiError(404, 'Price record not found');
        }

        const beforeCount = price.dailyRates.length;
        price.dailyRates = price.dailyRates.filter(
            (rate: any) => rate._id.toString() !== dailyPriceId.toString()
        );

        if (beforeCount === price.dailyRates.length) {
            throw new ApiError(404, 'Daily price not found');
        }

        await price.save();

        return res.json(new ApiResponse(200, 'Daily price deleted successfully'))

    } catch (err) {
        return next(err);
    }
}
