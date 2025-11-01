import { Request, Response, NextFunction } from "express"
import { validateObjectId } from "../../../utils/mongo-helper/mongo.utils"
import { User } from "../../../models/user/user"
import { ApiError } from "../../../utils/error-handlers/ApiError"
import { Reservation } from "../../../models/reservation/reservation"
import { Reviews } from "../../../models/reviews/reviews"
import { Property } from "../../../models/property/property"
import { ApiResponse } from "../../../utils/error-handlers/ApiResponse"
import moment from "moment"

export async function postReviewById(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { content, rating } = req.body
    const userId = req.user._id
    try {

        const reservationId = validateObjectId(req.params.reservationId)

        const sessionUser = await User.findById(userId).select('status')

        if (sessionUser.status === "suspended") {
            throw new ApiError(
                409,
                'Your account is currently suspended. Please contact our support team for assistance.'
            )
        }
        if (!rating) {
            throw new ApiError(400, 'Rating is mandatory');
        }

        const ratingNum = Number(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            throw new ApiError(400, 'Rating must be a number between 1 and 5');
        }

        if (typeof content !== 'string') {
            throw new ApiError(400, 'Content must be a string');
        }



        const reservation = await Reservation.findOne({
            _id: reservationId,
            status: { $in: ['complete', 'cancelled'] },
        });


        if (!reservation) {
            throw new ApiError(404, 'No reservation found to provide review')
        }

        const existingReview = await Reviews.findOne({ reservationId, userId })
        if (existingReview) {
            throw new ApiError(404, 'Review already exist posting again is not allowed')

        }
        await Reviews.create({ reservationId, userId, propertyId: reservation.propertyId, rating, content })

        const property = await Property.findById(reservation.propertyId)
        if (property) {
            await property.updateAvgRating();
        }
        return res.json(new ApiResponse(200, 'Review added successfully to this reservation.'))
    }
    catch (err) {
        console.log({ err });

        next(err)
    }
}

export async function updateReviewById(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { content, rating } = req.body
    const userId = req.user._id
    try {

        const sessionUser = await User.findById(userId).select('status')

        if (sessionUser.status === "suspended") {
            throw new ApiError(
                409,
                'Your account is currently suspended. Please contact our support team for assistance.'
            )
        }
        if (!rating) {
            throw new ApiError(400, 'Rating is mandatory');
        }

        const ratingNum = Number(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            throw new ApiError(400, 'Rating must be a number between 1 and 5');
        }

        if (typeof content !== 'string') {
            throw new ApiError(400, 'Content must be a string');
        }

        const reservationId = validateObjectId(req.params.reservationId)

        const review = await Reviews.findOne({ reservationId, userId }).select('_id reviewedAt propertyId')

        if (!review) {
            throw new ApiError(404, 'No review found to update')
        }
        const reviewedAt = moment(review.reviewedAt);
        const now = moment();

        const isOlderThan2Days = now.diff(reviewedAt, 'days') > 2;

        if (isOlderThan2Days) {
            throw new ApiError(409, 'You can only modify reviews within 2 days of creation.');
        }

        await Reviews.updateOne({ _id: review._id }, { $set: { content, rating } })

        const property = await Property.findById(review.propertyId)
        if (property) {
            await property.updateAvgRating()
        }


        return res.json(new ApiResponse(200, 'Review updated successfully.'))
    }
    catch (err) {
        next(err)
    }
}

export async function deleteReviewById(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const userId = req.user._id
    try {

        const reservationId = validateObjectId(req.params.reservationId)

        const review = await Reviews.findOne({ reservationId, userId })

        if (!review) {
            throw new ApiError(404, 'No review found to delete')
        }

        await Reviews.deleteOne({ _id: review._id, userId })

        return res.json(new ApiResponse(200, 'Review deleted successfully.'))
    }
    catch (err) {
        next(err)
    }
}
