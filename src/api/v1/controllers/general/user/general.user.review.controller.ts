import { NextFunction, Request, Response } from 'express';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { Reviews } from '../../../models/property/reviews';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { Property } from '../../../models/property/property';
import { deepFilterObject } from '../../../utils/mutation/mutation.utils';

export async function getUserReview(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const propertyId = validateObjectId(req.params.propertyId);

      const userReview = await Reviews.find({
         userId: user._id,
         propertyId: propertyId,
      });

      res.status(200).json(
         new ApiResponse(200, 'User review fetched successfully', userReview),
      );
   } catch (err) {
      next(err);
   }
}
export async function postUserReview(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const user = req.user as ISessionUser;
      const propertyId = validateObjectId(req.params.propertyId);
      const { rating, content } = req.body;

      // Validate rating
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
      // Check if user already reviewed this property
      const existingReview = await Reviews.findOne({
         userId: user._id,
         propertyId: propertyId,
      });

      if (existingReview) {
         throw new ApiError(
            400,
            'You have already reviewed this property. Please update your existing review instead.',
         );
      }

      // Create new review with validated data
      const newReview = await Reviews.create({
         userId: user._id,
         propertyId: propertyId,
         ...deepFilterObject({ rating: Number(rating), content }),
      });
      const property = await Property.findById({ _id: propertyId });
      await property.updateAvgRating();
      return res
         .status(201)
         .json(new ApiResponse(201, 'Review posted successfully', newReview));
   } catch (err) {
      return next(err);
   }
}
export async function updateUserReviews(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const propertyId = validateObjectId(req.params.propertyId);

      const { rating, content } = req.body;
      const ratingNum = Number(rating);

      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
         throw new ApiError(400, 'Rating must be a number between 1 and 5');
      }
      const userReview = await Reviews.findOne({
         userId: user._id,
         propertyId: propertyId,
      });
      if (!userReview) {
         throw new ApiError(400, 'No user Review found to update.');
      }
      Object.assign(userReview, { rating: Number(rating), content });

      await userReview.save();
      const property = await Property.findOne({ _id: propertyId });
      await property.updateAvgRating();

      res.status(200).json(
         new ApiResponse(200, 'User review updated successfully', userReview),
      );
   } catch (err) {
      next(err);
   }
}
export async function deleteUserReview(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const user = req.user as ISessionUser;
      const propertyId = validateObjectId(req.params.propertyId);

      const userReviewTodelete = await Reviews.findOne({
         userId: user._id,
         propertyId: propertyId,
      });

      if (!userReviewTodelete) {
         throw new ApiError(404, 'No user review found to delete.');
      }

      await userReviewTodelete.deleteOne();
      const property = await Property.findOne({ _id: propertyId });
      await property.updateAvgRating();

      return res
         .status(200)
         .json(
            new ApiResponse(
               200,
               'User review deleted successfully',
               userReviewTodelete,
            ),
         );
   } catch (err) {
      return next(err);
   }
}
