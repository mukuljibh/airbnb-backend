import { Request, Response, NextFunction } from 'express';
import { User } from '../../../models/user/user';
import { validateObjectId, withMongoTransaction } from '../../../utils/mongo-helper/mongo.utils';
import { Property } from '../../../models/property/property';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { getHostAllPropertiesReviewsStatistics } from '../../../utils/aggregation-pipelines/agregation.utils';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import UserQuery from '../../../models/userQuery';
import { doesHostHaveActiveOrUpcomingReservation, getUserQueriesList } from './services/user.service';
import { PipelineStage } from 'mongoose';
import { USER_STATUS } from '../../../models/user/enums/user.enum';
import { UserStatus } from '../../../models/user/types/user.model.types';
import { SessionStore } from '../../../models/session/SessionStore';
import { formatDate } from '../../../utils/dates/dates.utils';
import { changePropertyState } from '../../common/property/property.service';
import { changeUserState } from '../../common/user/services/account.service';
import { createRecipient, dispatchNotification } from '../../common/notifications/services/dispatch.service';
import { getAllRoomWithAdmin } from '../../../repository/room.repo';

interface UserQueryParams {
   role?: string;
   status?: Exclude<UserStatus, 'pending'>
}

export async function getUsersList(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const {
      role = 'all',
      status = ''
   } = req.query as UserQueryParams;
   const filterConditions: {
      status?: Exclude<UserStatus, 'pending'> | any,
      role?: [string, string] | [string] | { $nin: string[] };
      $or?: unknown[];
      hasBasicDetails?: boolean;
   } = { role: { $nin: ['admin'] }, hasBasicDetails: true };

   const { sort, pagination, search } = res.locals
   const { limit, page, startIndex } = pagination
   const { searchTerm } = search
   const { sortDirection, sortField } = sort

   try {

      if (!['guest', 'host', 'all'].includes(role)) {
         throw new ApiError(400, 'provide role either guest | host | all');
      }
      filterConditions.status = { $in: [USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED] }

      if (status) {
         filterConditions.status = status

      }

      if (status === USER_STATUS.DELETED) {
         const groupedDeletedStatus = [USER_STATUS.PENDING_DELETION, USER_STATUS.DELETED]
         filterConditions.status = { $in: groupedDeletedStatus }
      }

      if (role !== 'all' && role !== 'admin') {
         if (role === 'guest') {
            filterConditions.role = ['guest'];
         } else {
            filterConditions.role = ['guest', 'host'];
         }
      }


      if (searchTerm && searchTerm.trim() !== '') {
         const escapedSearchTerm = searchTerm.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
         );

         filterConditions.$or = [
            { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: escapedSearchTerm, options: "i" } } },
            { email: { $regex: escapedSearchTerm, $options: 'i' } },
            { 'address.country': { $regex: escapedSearchTerm, $options: 'i' } },
            { 'address.state': { $regex: escapedSearchTerm, $options: 'i' } },
            { 'address.city': { $regex: escapedSearchTerm, $options: 'i' } },
            { 'address.pincode': { $regex: escapedSearchTerm, $options: 'i' } },
            { 'phone.number': { $regex: escapedSearchTerm, $options: 'i' } },
         ]


      }

      const pipeline: PipelineStage[] = [

         { $match: filterConditions },
         {
            $addFields: {
               deletedAt: {
                  $ifNull: ["$deletedAt", "$deletionRequestedAt"]
               }
            }
         },

         { $sort: { [sortField]: sortDirection } },
         { $skip: startIndex },
         { $limit: limit },
         {
            $project: {
               firstName: 1,
               fullName: 1,
               lastName: 1,
               address: 1,
               email: 1,
               phone: 1,
               role: 1,
               provider: 1,
               status: 1,
               createdAt: 1,
               dob: 1,
               deletedAt: 1,
               profilePicture: 1,
               hasEmailVerified: 1,
               hasPhoneVerified: 1,
            },
         },
      ];

      const userAggregation = User.aggregate(pipeline);
      const countPromise = User.countDocuments(filterConditions)

      const [userResults, count] = await Promise.all([userAggregation, countPromise])
      const totalUsers = count

      return res.json({
         statusCode: 200,
         success: true,
         message: 'Users fetched successfully.',
         data: userResults,
         currentPage: page,
         totalPages: Math.ceil(totalUsers / limit),
         totalUsers,
      });
   } catch (err) {
      next(err);
   }
}

export async function suspendUserAccount(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const userId = validateObjectId(req.params.userId);

      const { reason } = req.body

      const targetUser = await User.findOne({ _id: userId }).select('-password')

      if (!targetUser) {
         throw new ApiError(404, 'User not found.')
      }

      await withMongoTransaction(async (session) => {


         const userChangeState = changeUserState({ userId: userId, userNewStatus: "suspended", reason, role: "admin", session })

         const propertyChangeState = changePropertyState({ userId, newPropertyStatus: "suspended", reason, role: "admin", session })

         await Promise.all([userChangeState, propertyChangeState])

      })


      const userName = `${targetUser.firstName} ${targetUser.lastName}`
      const formatedNowDate = formatDate(new Date())
      const [guestRoom, hostRoom] = await getAllRoomWithAdmin({ targetUserId: userId })

      const suspensionPayload = createRecipient('both', {
         emailOptions: {
            type: "ACCOUNT_SUSPENSION",
            destination: targetUser.email,
            replacement: { date: formatedNowDate, userName: userName, reason }
         },
         notificationOptions: {
            redirectKey: "contact-support",
            userId: String(targetUser._id),
            message: `Your account has been suspended due to policy violations. Please contact support for more information.`,
            visibleToRoles: ['guest'],
            title: `Account Suspended`,
            metadata: {
               roomId: guestRoom?.roomId ? String(guestRoom.roomId) : null,
               roomUniqueId: guestRoom?.roomUniqueId ? String(guestRoom.roomUniqueId) : null

            }
         }
      })
      const hostRecipientPayload = createRecipient('inApp', {
         redirectKey: "contact-support",
         userId: String(targetUser._id),
         message: `Your account has been suspended due to policy violations. Please contact support for more information.`,
         visibleToRoles: ['host'],
         title: `Account Suspended`,
         metadata: {
            roomId: hostRoom?.roomId ? String(hostRoom.roomId) : null,
            roomUniqueId: hostRoom?.roomUniqueId ? String(hostRoom.roomUniqueId) : null
         }
      })
      dispatchNotification({ recipients: [suspensionPayload, hostRecipientPayload] })

      return res.json(
         new ApiResponse(
            200,
            'The user account has been suspended successfully.')
      );
   } catch (err) {
      console.error(err);
      next(err);
   }
}


export async function unsuspendUserAccount(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { reason = 'opening account as per request' } = req.body
      const userId = validateObjectId(req.params.userId);
      const targetUser = await User.findOne({ _id: userId, status: USER_STATUS.SUSPENDED }).select('-password')

      if (!targetUser) {
         throw new ApiError(404, 'No suspended user found.')
      }

      await withMongoTransaction(async (session) => {
         const userChangeState = changeUserState({ userId: userId, userNewStatus: "unsuspended", reason, role: "admin", session })

         const propertyChangeState = changePropertyState({ userId: userId, newPropertyStatus: "unsuspended", reason, role: "admin", session })

         await Promise.all([userChangeState, propertyChangeState])
      })


      const userName = `${targetUser.firstName} ${targetUser.lastName}`
      const formatedNowDate = formatDate(new Date())

      const unsuspendPayload = createRecipient('both', {
         emailOptions: {
            type: 'ACCOUNT_UNSUSPENSION',
            destination: targetUser.email || targetUser.contactEmail,
            replacement: { date: formatedNowDate, userName: userName }
         },
         notificationOptions: {

            userId: String(targetUser._id),
            message: `Your account has been reinstated. You can now continue using our platform.`,
            visibleToRoles: ['guest', 'host'],
            title: `Account Reinstated`,
            redirectKey: null,
            metadata: null
         }
      })

      dispatchNotification({ recipients: [unsuspendPayload] })

      return res.json(
         new ApiResponse(
            200,
            'The user account has been unsuspended successfully.')
      );

   } catch (err) {
      console.error(err);
      next(err);
   }
}


export async function permanentDeleteAccount(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { reason = 'violating terms of condition so admin decides to delete' } = req.body
      const { userId } = req.params;


      const targetUser = await User.findOne({ _id: userId, status: { $ne: USER_STATUS.PENDING } })

      if (!targetUser) {
         throw new ApiError(404, 'User not found.')
      }

      const hasReservation = await doesHostHaveActiveOrUpcomingReservation(targetUser._id)

      if (hasReservation) {
         throw new ApiError(
            409,
            'This user account cannot be deleted because there are active reservations or trips associated with it.'
         );
      }


      await withMongoTransaction(async (session) => {

         const userChangeState = changeUserState({ userId: targetUser._id, userNewStatus: "deleted", reason, role: "admin", session })

         const propertyChangeState = changePropertyState({ userId: targetUser._id, newPropertyStatus: "deleted", reason, role: "admin", session })

         const userSessionState = SessionStore.deleteMany({ userId: targetUser._id }, { session })

         await Promise.all([userChangeState, propertyChangeState, userSessionState])


      })

      const userName = `${targetUser.firstName} ${targetUser.lastName}`
      const formatedNowDate = formatDate(new Date())

      const payload = createRecipient('email', {
         destination: targetUser.email,
         type: 'DELETE_ACCOUNT_BY_ADMIN',
         replacement: { deletionDate: formatedNowDate, userName: userName }
      })

      dispatchNotification({ recipients: [payload] })

      return res.json(new ApiResponse(200, 'User deleted successfully.'))

   } catch (err) {
      console.error(err);
      next(err);
   }
}

export async function getHostPropertiesWithReviews(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const hostId = validateObjectId(req.params.userId);
      const hostDetails = await User.findById(hostId).select(
         'firstName lastName email bio languages profilePicture address role hasEmailVerified hasPhoneVerified createdAt isSoftDelete',
      );
      if (!hostDetails) {
         throw new ApiError(404, 'No host found with request host id')
      }
      const awaitingPublishedProperties = Property.aggregate([
         {
            $match: {
               hostId: hostId,
               visibility: 'published',
            },
         },
         {
            $project: {
               title: 1,
               avgRating: 1,
               thumbnail: 1,
               location: 1,
               status: 1,
            },
         },
      ]);

      const awaitingAllReviewsDetails = getHostAllPropertiesReviewsStatistics(
         hostId,
         {
            limit: 5,
         },
      );
      const [publishedProperties, allReviewsDetails] = await Promise.all([awaitingPublishedProperties, awaitingAllReviewsDetails])
      res.status(200).json(
         new ApiResponse(200, 'host details fetched successfully', {
            hostDetails,
            publishedProperties,
            allReviewsDetails,
         }),
      );
   } catch (err) {
      next(err);
   }
}

export async function getUserQueries(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const pageAttr = res.locals.pagination;
      const {
         status,
         searchTerm,
      }: {
         status?: 'open' | 'responded' | 'closed' | 'all';
         searchTerm?: string;
      } = req.query;

      const filter: Record<string, string> = {};

      if (!['all', 'open', 'closed', 'responded'].includes(status as string)) {
         return res
            .status(400)
            .json({ message: 'status can be all | open | closed | responded' });
      }

      if (status != 'all') {
         filter.status = status;
      }
      const result = await getUserQueriesList(filter, { searchTerm }, pageAttr);
      res.status(200).json(result);
   } catch (err) {
      next(err);
   }
}

export async function respondUserQuery(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const queryId = validateObjectId(req.params.queryId);
      const { status } = req.query;
      if (!['open', 'closed', 'responded'].includes(status as string)) {
         return res
            .status(400)
            .json({ message: 'status can be all | open | closed | responded' });
      }

      const userQuery = await UserQuery.findByIdAndUpdate(queryId, {
         $set: {
            status,
         },
      });
      if (!userQuery) {
         throw new ApiError(400, 'No user query found to update status.');
      }
      res.status(200).json(
         new ApiResponse(
            200,
            `User query status changed to ${status} successfully.`,
         ),
      );
   } catch (err) {
      next(err);
   }
}
