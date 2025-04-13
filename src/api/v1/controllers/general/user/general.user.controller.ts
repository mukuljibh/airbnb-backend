import { NextFunction, Request, Response } from 'express';
import { User } from '../../../models/user/user';

import { parse } from 'date-fns';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { Property } from '../../../models/property/property';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { getHostAllPropertiesReviewsStatistics } from '../../../utils/aggregation-pipelines/agregation.utils';
import { clearCookies } from '../../../utils/cookies/cookies.utils';
import { decodeJwtToken } from '../../common/user/utils/common.user.utils';
import { PayloadType } from '../../common/user/utils/common.user.utils';
import { userEmitter } from '../../../events/user/user.emitter';
export async function submitProfileDetails(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { firstName, lastName, dob, password, contactEmail } = req.body;
   const profilesessionIdToken = req.cookies['profilesessionid'];
   const { userId, verificationFlag } = decodeJwtToken<PayloadType>(
      profilesessionIdToken,
   ).data;

   try {
      if (!profilesessionIdToken) {
         throw new ApiError(400, 'No active session found for profile', {
            step: 'login',
         });
      }

      const user = await User.findById(userId);

      if (!user) {
         throw new ApiError(
            401,
            `You did not intiate the sign up process please generate one to continue`,
            {
               step: 'login',
            },
         );
      }
      if (!user[verificationFlag]) {
         throw new ApiError(401, `Please complete your verification first.`, {
            step: 'verify-otp',
         });
      }
      if (user.hasBasicDetails) {
         throw new ApiError(
            401,
            'You do not have permission to perform this action.',
            { step: 'login' },
         );
      }

      let parsedDob;
      try {
         parsedDob = parse(dob, 'dd-MM-yyyy', new Date());
      } catch (error) {
         throw new ApiError(400, 'Invalid date format. Use dd-MM-yyyy.', {
            step: 'profile',
            error,
         });
      }
      Object.assign(user, {
         firstName,
         lastName,
         dob: parsedDob,
         password,
         hasBasicDetails: true,
         contactEmail,
      });
      await user.save();
      clearCookies(res, req.baseUrl, ...Object.keys(req.cookies));
      userEmitter.emit('user:welcome', {
         type: 'WELCOME',
         destination: user?.email || user?.contactEmail,
         replacement: { name: `${user.firstName} ${user.lastName}` },
         userId: user._id,
      });

      res.status(201).json(
         new ApiResponse(200, 'Profile created successfully!', {
            step: 'login',
         }),
      );
   } catch (error) {
      console.log(error);
      next(error);
   }
}

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

      const publishedProperties = await Property.aggregate([
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
            $project: {
               title: 1,
               avgRating: 1,
               thumbnail: 1,
               amenitiesDetails: { $slice: ['$amenitiesDetails', 2] },
            },
         },
      ]);
      const allReviewsDetails = await getHostAllPropertiesReviewsStatistics(
         hostId,
         {
            limit: 4,
         },
      );
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

export async function getHostPropertiesAllReviews(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const pagesAttr = res.locals.pagination;
   try {
      const hostId = validateObjectId(req.params.hostId);
      const allReviewsDetails = await getHostAllPropertiesReviewsStatistics(
         hostId,
         pagesAttr,
      );

      const result = formatPaginationResponse(
         allReviewsDetails,
         allReviewsDetails?.totalReviewCount,
         pagesAttr,
      );
      res.json(result);
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

      const publishedProperties = await Property.aggregate([
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
            $project: {
               title: 1,
               avgRating: 1,
               thumbnail: 1,
               amenitiesDetails: { $slice: ['$amenitiesDetails', 2] },
            },
         },
      ]);
      const totalPublishCount = await Property.countDocuments({
         hostId: hostId,
         visibility: 'published',
      });

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
