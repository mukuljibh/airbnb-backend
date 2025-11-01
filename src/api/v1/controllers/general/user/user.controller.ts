import { NextFunction, Request, Response } from 'express';
import { User } from '../../../models/user/user';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { Property } from '../../../models/property/property';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { getHostAllPropertiesReviewsStatistics } from '../../../utils/aggregation-pipelines/agregation.utils';



export async function getHostStatistics(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const hostId =
         (req.params.hostId && validateObjectId(req.params.hostId)) ||
         user?._id;
      const viewingOwnProfile = hostId.equals(user?._id);

      const hostDetails = await User.findOne({ _id: hostId }).select(
         'firstName lastName email bio languages profilePicture role hasEmailVerified hasPhoneVerified createdAt',
      );

      const publishedPropertiesAggregation = Property.aggregate([
         {
            $match: {
               hostId: hostId,
               visibility: 'published',
            },
         },

         {
            $lookup: {
               from: 'amenities',
               localField: 'amenities',
               foreignField: '_id',
               as: 'amenitiesDetails',
            },
         },
         {
            $limit: 4,
         },
         {
            $project: {
               title: 1,
               avgRating: 1,
               thumbnail: 1,
               amenitiesDetails: { $slice: ['$amenitiesDetails', 2] },
            },
         },
      ]);
      const allReviewsDetailsAggegation = getHostAllPropertiesReviewsStatistics(
         hostId,
         {
            limit: 4,
         },
      );
      const [publishedProperties, allReviewsDetails] = await Promise.all([
         publishedPropertiesAggregation,
         allReviewsDetailsAggegation,
      ]);
      res.status(200).json(
         new ApiResponse(200, 'host details fetched successfully', {
            viewingOwnProfile,
            hostDetails,
            publishedProperties,
            allReviewsDetails,
         }),
      );
   } catch (err) {
      next(err);
   }
}


export async function getHostAllPublishedProperties(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const pagesAttr = res.locals.pagination;
   try {
      const hostId = validateObjectId(req.params.hostId);

      const filter = {
         hostId: hostId,
         visibility: 'published',
      };
      const publishedPropertiesAggregation = Property.aggregate([
         {
            $match: filter,
         },

         {
            $lookup: {
               from: 'amenities',
               localField: 'amenities',
               foreignField: '_id',
               pipeline: [
                  {
                     $limit: 2
                  }
               ],
               as: 'amenitiesDetails',
            },
         },
         {
            $project: {
               title: 1,
               avgRating: 1,
               thumbnail: 1,
               amenitiesDetails: '$amenitiesDetails',
            },
         },
      ]);
      const countAggregation = Property.countDocuments(filter);

      const [publishedProperties, totalPublishCount] = await Promise.all([
         publishedPropertiesAggregation,
         countAggregation,
      ]);
      const result = formatPaginationResponse(
         publishedProperties,
         totalPublishCount,
         pagesAttr,
      );
      res.json(result);
   } catch (err) {
      next(err);
   }
}

export async function guestBecomeHost(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const dbUser = await User.findById(user._id);

      if (dbUser.status == "suspended") {
         throw new ApiError(
            409,
            'Your account is currently suspended. Please contact our support team for assistance.'
         )
      }
      if (!dbUser) {
         throw new ApiError(404, 'User not found');
      }

      if (dbUser.role.includes('host')) {
         throw new ApiError(400, 'You are already registered as a host');
      }

      dbUser.role.push('host');
      await dbUser.save();

      res.status(200).json(
         new ApiResponse(
            200,
            'Congratulations! Your host account has been successfully activated.',
         ),
      );
   } catch (err) {
      next(err);
   }
}
