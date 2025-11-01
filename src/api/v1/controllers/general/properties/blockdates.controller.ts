import { Request, Response, NextFunction } from "express";
import moment from "moment";
import { ApiError } from "../../../utils/error-handlers/ApiError";
import { validateObjectId, withMongoTransaction } from "../../../utils/mongo-helper/mongo.utils";
import { Reservation } from "../../../models/reservation/reservation";
import { Property } from "../../../models/property/property";
import { ApiResponse } from "../../../utils/error-handlers/ApiResponse";
import { User } from "../../../models/user/user";
import { IPricing } from "../../../models/price/types/price.model.type";
import { checkAvailableDatesForHost } from "./services/property.service";

export async function selfBookProperty(
    req: Request,
    res: Response,
    next: NextFunction,
) {

    const user = req.user;
    const query: Partial<{
        checkInDate: Date;
        checkOutDate: Date;
    }> = req.query;

    try {
        const checkInDate = moment.utc(query.checkInDate).startOf('day');
        const checkOutDate = moment.utc(query.checkOutDate).startOf('day');
        const { blockReason } = req.body;
        const today = moment.utc(new Date()).startOf('day');

        const hostUser = await User.findById(user._id).select('status')

        if (hostUser.status === "suspended") {
            throw new ApiError(
                409,
                'Your account is currently suspended. Please contact our support team for assistance.'
            )
        }

        if (!checkInDate.isValid() || !checkOutDate.isValid()) {
            throw new ApiError(400, 'Invalid date format');
        }

        if (checkInDate.isBefore(today)) {
            throw new ApiError(400, 'Check-in date must be today or later');
        }

        if (!checkOutDate.isAfter(checkInDate)) {
            throw new ApiError(
                400,
                'Check-out date must be at least 1 day after check-in',
            );
        }

        const propertyId = validateObjectId(req.params.propertyId);


        await withMongoTransaction(async (session) => {
            const property = await Property.findOne({
                _id: propertyId,
                hostId: user._id,
                visibility: 'published',
            }).session(session);

            if (!property) {
                throw new ApiError(404, 'Property not found.');
            }

            const isDatesAvailable = await property.checkAvailableDate(
                checkInDate.toDate(),
                checkOutDate.toDate(),
            );

            if (!isDatesAvailable) {
                throw new ApiError(
                    208,
                    'These dates cannot be used for self-booking as they are currently in use.',
                );
            }

            const reservationPayload = {
                hostId: user._id,
                userId: user._id,
                checkInDate: checkInDate.toDate(),
                checkOutDate: checkOutDate.toDate(),
                propertyId,
                isSelfBooked: true,
                status: 'complete',
                expiresAt: null,
            };

            if (blockReason) {
                reservationPayload['blockReason'] = blockReason;
            }
            await Reservation.create([reservationPayload], { session });
        })


        res.json(
            new ApiResponse(
                201,
                'Reservation successfully blocked for the provided dates.',
            ),
        );
    } catch (err) {
        console.error(
            `[selfBookProperty] Error for user ${req.user?.['_id']}:`,
            err,
        );
        next(err);
    }
}

export async function getSelfAndGuestBlocksByPropertyId(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const user = req.user;
    try {
        const propertyId = validateObjectId(req.params.propertyId);
        const todayDate = moment.utc(new Date()).startOf('day').toDate();
        const filter = {
            hostId: user._id,
            propertyId,
            // checkOutDate: { $gte: todayDate },
        };
        const property = await Property.findOne({
            _id: propertyId,
            hostId: user._id,
            visibility: 'published',
        }).populate<{ price: IPricing }>('price', 'dailyRates basePrice')

            ;
        if (!property) {
            throw new ApiError(
                404,
                'No property found with provided property id.',
            );
        }

        const endDate = moment
            .utc(todayDate)
            .startOf('day')
            .add(property.availabilityWindow, 'months')
            .toDate();

        const [dates] = await Reservation.aggregate([
            {
                $match: filter,
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDetails',
                },
            },
            {
                $unwind: {
                    path: '$userDetails',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'billings',
                    localField: '_id',
                    foreignField: 'reservationId',
                    as: 'billing',
                },
            },

            {
                $unwind: {
                    path: '$billing',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $facet: {
                    selfBlockedDate: [
                        { $match: { isSelfBooked: true } },
                        {
                            $project: {
                                _id: 0,
                                startDate: '$checkInDate',
                                endDate: '$checkOutDate',
                                status: 1,
                                reservationCode: 1,
                                blockReason: 1,
                                reservationId: '$_id',
                            },
                        },
                        { $sort: { endDate: 1, status: 1 } },
                    ],
                    guestBlockDate: [
                        {
                            $match: {
                                isSelfBooked: false,
                                status: { $nin: ['cancelled'] },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                startDate: '$checkInDate',
                                endDate: '$checkOutDate',
                                billing: 1,
                                status: 1,
                                reservationCode: 1,
                                reservationId: '$_id',

                                'userDetails.firstName': 1,
                                'userDetails.lastName': 1,
                                'userDetails.email': 1,
                                'userDetails.phone': 1,
                            },
                        },
                        { $sort: { endDate: 1, status: 1 } },
                    ],
                },
            },
        ]);

        res.json(
            new ApiResponse(
                200,
                'Self block and guest block dates fetched successfully',
                {
                    ...dates,
                    propertyAvailabilityWindow: {
                        startDate: todayDate,
                        endDate,
                    },
                    basePrice: property?.price?.basePrice,
                    dailyPriceRates: property?.price?.dailyRates
                },
            ),
        );
    } catch (err) {
        next(err);
    }
}
export async function unblockSelfBlockedDates(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const user = req.user;

    try {

        const reservationId = validateObjectId(req.params.reservationId);
        const hostUser = await User.findById(user._id).select('status')

        if (hostUser.status === "suspended") {
            throw new ApiError(
                409,
                'Your account is currently suspended. Please contact our support team for assistance.'
            )
        }

        const reservation = await Reservation.findOne({
            _id: reservationId,
            userId: user._id,
        });

        if (!reservation) {
            throw new ApiError(
                404,
                'No self-reservation found to unblock. Please ensure you are providing the correct reservationId.',
            );
        }
        await reservation.deleteOne();

        return res.json(
            new ApiResponse(
                200,
                'The blocked dates have been successfully released and are now available for booking on the main website.',
            ),
        );
    } catch (err) {
        console.error(`User ${user?._id} failed to unblock reservation:`, err);
        next(err);
    }
}

export async function updateSelfBlockedDates(
    req: Request,
    res: Response,
    next: NextFunction,
) {

    const user = req.user;

    try {
        const { blockReason } = req.body;
        const query: Partial<{
            checkInDate: Date;
            checkOutDate: Date;
        }> = req.query;

        let checkInDate = moment.utc(query.checkInDate).startOf('day');
        const checkOutDate = moment.utc(query.checkOutDate).startOf('day');
        const today = moment.utc(new Date()).startOf('day');

        const hostUser = await User.findById(user._id).select('status')

        if (hostUser.status === "suspended") {
            throw new ApiError(
                409,
                'Your account is currently suspended. Please contact our support team for assistance.'
            )
        }
        if (!checkInDate.isValid() || !checkOutDate.isValid()) {
            throw new ApiError(400, 'Invalid date format');
        }

        if (
            !checkOutDate.isAfter(checkInDate) &&
            !checkOutDate.isSameOrAfter(today)
        ) {
            throw new ApiError(
                400,
                'Check-out date must be at least 1 day after check-in and 1 day after or same as todays date',
            );
        }

        const reservationId = validateObjectId(req.params.reservationId);


        await withMongoTransaction(async (session) => {
            const reservation = await Reservation.findOne({
                userId: user._id,
                _id: reservationId,
            }).session(session);

            if (!reservation) {
                throw new ApiError(404, 'No self-reservation found to update.');
            }

            const prevCheckIn = moment.utc(reservation.checkInDate).startOf('day');
            const prevCheckOut = moment
                .utc(reservation.checkOutDate)
                .startOf('day');

            const isDateChanged =
                !prevCheckIn.isSame(checkInDate) ||
                !prevCheckOut.isSame(checkOutDate);

            if (prevCheckIn.isBefore(today)) {
                //if db checkin date is before today date just accept and ignore that upcoming checkinDate re assign back to db checkin date and flow silently
                checkInDate = prevCheckIn;
            }
            if (isDateChanged) {
                const isAvailable = await checkAvailableDatesForHost(
                    checkInDate.toDate(),
                    checkOutDate.toDate(),
                    reservation.propertyId,
                    reservation._id,
                );

                if (!isAvailable) {
                    throw new ApiError(
                        400,
                        'These dates cannot be used for self-booking as they are already in use.',
                    );
                }

                reservation.checkInDate = checkInDate.toDate();
                reservation.checkOutDate = checkOutDate.toDate();
            }

            if (blockReason) {
                reservation.blockReason = blockReason;
            }

            await reservation.save({ session });
        })


        res.status(200).json(
            new ApiResponse(
                200,
                'The blocked dates have been successfully updated.',
            ),
        );
    } catch (err) {
        console.error(
            `[updateSelfBlockedDates] Error for user ${user._id}:`,
            err,
        );
        next(err);
    }
}
