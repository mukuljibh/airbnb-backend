import mongoose from 'mongoose';
import { Property } from '../../models/property/property';
import { IReviews } from '../../models/property/reviews';
import { Reviews } from '../../models/property/reviews';
import { ApiError } from '../error-handlers/ApiError';
import { User } from '../../models/user/user';
import { IUser } from '../../models/user/types/user.model.types';
export async function getHostAllPropertiesReviewsStatistics(
   hostId: mongoose.Types.ObjectId,
   pagesAttr?: Partial<{
      startIndex: number;
      limit: number;
   }>,
): Promise<{
   totalReviewCount: number;
   overallAvgRating: number;
   allReviews: IReviews;
}> {
   const filter = [];
   if (pagesAttr?.startIndex) {
      filter.push({ $skip: pagesAttr.startIndex });
   }
   if (pagesAttr?.limit) {
      filter.push({ $limit: pagesAttr.limit });
   }

   const allReviewsDetails = [
      {
         $match: {
            hostId: hostId,
            visibility: 'published',
         },
      },
      {
         $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'propertyId',
            as: 'reviews',
         },
      },
      {
         $unwind: {
            path: '$reviews',
            preserveNullAndEmptyArrays: false,
         },
      },
      {
         $lookup: {
            from: 'users',
            localField: 'reviews.userId',
            foreignField: '_id',
            as: 'userDetails',
         },
      },
      {
         $unwind: {
            path: '$userDetails',
            preserveNullAndEmptyArrays: false,
         },
      },
      {
         $facet: {
            stats: [
               {
                  $group: {
                     _id: null,
                     totalReviewCount: { $sum: 1 },
                     overallAvgRating: { $avg: '$reviews.rating' },
                  },
               },
            ],
            limitedReviews: [
               ...filter,
               {
                  $group: {
                     _id: null,
                     allReviews: {
                        $push: {
                           createdAt: '$reviews.createdAt',
                           property_id: '$reviews.propertyId',
                           user_id: '$reviews.userId',
                           user: {
                              firstName: '$userDetails.firstName',
                              lastName: '$userDetails.lastName',
                              profileImage: '$userDetails.profilePicture',
                           },
                           content: '$reviews.content',
                           rating: '$reviews.rating',
                        },
                     },
                  },
               },
               {
                  $project: {
                     _id: 0,
                     allReviews: 1,
                  },
               },
            ],
         },
      },
      {
         $project: {
            totalReviewCount: {
               $arrayElemAt: ['$stats.totalReviewCount', 0],
            },
            overallAvgRating: {
               $arrayElemAt: ['$stats.overallAvgRating', 0],
            },
            allReviews: { $arrayElemAt: ['$limitedReviews.allReviews', 0] },
         },
      },
   ];

   return (await Property.aggregate(allReviewsDetails))[0];
}

export async function getAvgReviewsForSinglePropertyPipeline(
   id: mongoose.Types.ObjectId | null,
   limit?: number | null,
) {
   // Start with an empty match stage
   const matchStage = id ? { propertyId: id } : {};
   const pipeline = [
      { $match: matchStage },
      {
         $facet: {
            reviews: [
               { $sort: { rating: -1 } },
               ...(limit ? [{ $limit: limit }] : []),
               {
                  $lookup: {
                     from: 'users',
                     localField: 'userId',
                     foreignField: '_id',
                     as: 'user',
                  },
               },
               { $unwind: '$user' },
               {
                  $project: {
                     _id: 1,
                     content: 1,
                     rating: 1,
                     createdAt: 1,
                     'user._id': 1,
                     'user.firstName': 1,
                     'user.lastName': 1,
                     'user.profileImage': '$user.profilePicture',
                  },
               },
            ],
            // averageRating: [
            //    {
            //       $group: {
            //          _id: null,
            //          avgRating: { $avg: '$rating' },
            //       },
            //    },
            // ],
            totalReviews: [{ $count: 'count' }],
         },
      } as mongoose.PipelineStage,
      {
         $project: {
            reviews: 1,
            // averageRating: { $arrayElemAt: ['$averageRating.avgRating', 0] },
            totalReviews: { $arrayElemAt: ['$totalReviews.count', 0] },
         },
      } as mongoose.PipelineStage,
   ];

   return (await Reviews.aggregate(pipeline))[0] as {
      reviews: IReviews[];
      // averageRating: number;
      totalReviews: number;
   };
}

export async function getSinglePropertyAvgReviews(
   propertyId: mongoose.Types.ObjectId,
) {
   const matchStage = propertyId ? { _id: propertyId } : {};

   const property = await Property.aggregate<{
      totalReviews: number;
      averageRating: number;
   }>([
      { $match: matchStage },
      {
         $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'propertyId',
            as: 'result',
         },
      },
      {
         $unwind: {
            path: '$result',
            preserveNullAndEmptyArrays: false,
         },
      },
      {
         $group: {
            _id: '$_id',
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$result.rating' },
         },
      },
      {
         $project: {
            _id: 1,
            totalReviews: 1,
            averageRating: { $round: ['$averageRating', 1] },
         },
      },
   ]);

   return property;
}

export type UserMinimalDetailType = Pick<
   IUser,
   | '_id'
   | 'firstName'
   | 'lastName'
   | 'role'
   | 'phone'
   | 'email'
   | 'hasBasicDetails'
   | 'hasPhoneVerified'
   | 'hasEmailVerified'
>;

export async function getUserFromDb(userId: mongoose.Types.ObjectId) {
   if (!userId) {
      throw new ApiError(
         500,
         'something went wrong  session is missing from passport session object',
      );
   }
   const user = await User.findById(userId).select(
      'firstName lastName hasBasicDetails hasPhoneVerified hasEmailVerified role email phone',
   );
   if (!user) {
      throw new ApiError(
         500,
         'something went wrong cant able to get user from db',
      );
   }
   return user as UserMinimalDetailType;
}
