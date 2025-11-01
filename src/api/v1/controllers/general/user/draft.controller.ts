import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import mongoose from 'mongoose';
import { validateObjectId, withMongoTransaction } from '../../../utils/mongo-helper/mongo.utils';
import { Property } from '../../../models/property/property';
import { Price } from '../../../models/price/price';
import { PropertyRules } from '../../../models/property/propertyRules';
import { generateDraftOrPropertyCheckpoints } from './services/draft.service';
import { storeCheckpointData } from './services/draft.service';
import { Reservation } from '../../../models/reservation/reservation';
import _ from 'lodash';
import moment from 'moment';
import { syncAndDeleteFiles } from '../../../../uploads/services/upload.service';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { IProperty, PropertyStatusType } from '../../../models/property/types/property.model.types';
import { createRecipient, dispatchNotification } from '../../common/notifications/services/dispatch.service';
import { User } from '../../../models/user/user';
import * as commonPropertyService from "../../common/property/property.service"
import { Wishlist } from '../../../models/wishlist/wishList';
import { PROPERTY_STATUS } from '../../../models/property/propertyAttributes/propertyAttributes';

import * as commonDraftService from '../../common/property/property.service'


export async function saveCheckpointDraft(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { stage } = req.body;
   const user = req.user as ISessionUser;
   try {
      const countDraft = await Property.countDocuments({
         hostId: user._id,
         visibility: 'draft',
      });

      if (countDraft >= 5) {
         throw new ApiError(
            400,
            'You can only create atmost 5 draft at a time',
         );
      }
      const host = await User.findById(user._id).select('status')

      if (host.status === "suspended") {
         throw new ApiError(
            409,
            'Your account is currently suspended. Please contact our support team for assistance.'
         );
      }

      const draft = new Property();
      // Determine if it's a new draft or an existing one
      await withMongoTransaction(async (session) => {
         await storeCheckpointData({ draft, payload: req.body, userDetails: host, session });
         // Update the draft_stage to the current stage number
         draft.draftStage = stage;
         // draft.draftStage = stage;
         await draft.save({ session });
      })


      return res.json(
         new ApiResponse(201, `Draft stage ${stage} saved successfully`, {
            draftId: draft._id,
            stage,
            isComplete: false,
            nextStage: `stage ${stage + 1}`,
         }),
      );
   } catch (error) {
      console.log(error);
      return next(error);
   }
}

export async function updateCheckpoint(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   let draft: IProperty;
   try {
      const { stage } = req.body;
      const draftId = validateObjectId(req.params.propertyId);
      const user = req.user as ISessionUser;


      const host = await User.findById(user._id)

      await withMongoTransaction(async (session) => {
         draft = await Property.findOne({
            _id: draftId,
            hostId: user._id,
         }).session(session);
         if (!draft) {
            throw new ApiError(400, 'No draft available');
         }

         // If it's not published, verify the stage is valid to update
         if (draft.visibility !== 'published') {
            // Prevent skipping stages
            if (stage > draft.draftStage + 1) {
               throw new ApiError(
                  400,
                  `Please complete stage ${draft.draftStage + 1} before saving stage ${stage}`,
               );
            }
         }

         if (draft?.verification?.status === 'pending') {
            throw new ApiError(
               400,
               'please be patient your property is under review by our inspector',
            );
         }

         if (draft.visibility == 'published') {
            if (stage == 6) {
               throw new ApiError(
                  400,
                  'stage 6 not allowed for published property',
               );
            }

            else if (stage == 1) {
               req.body = _.omit(req.body, [
                  'propertyCity',
                  'propertyCountry',
                  'propertyState',
                  'propertyZipcode',
                  'propertyLandmark',
                  'propertyAddress',
                  'propertyCoordinates',
                  'propertyLandmark',
               ]);
            }

         }

         await storeCheckpointData({ draft, payload: req.body, userDetails: host, session });
         // Prepare new stage data
         const isPropertyPublished = draft.visibility === "published"

         if (!isPropertyPublished && stage > draft.draftStage) {
            draft.draftStage = stage;
         }

         await draft.save({ session });
      })


      let completedStages = null
      let hasDraftCompleted = draft.visibility === "published"

      if (draft.visibility === "draft") {
         completedStages = draft.draftStage
         hasDraftCompleted = completedStages === 6
      }

      return res.json(
         new ApiResponse(200, `Stage ${stage} updated successfully`, {
            currentCompleteStage: stage,
            isComplete: hasDraftCompleted,
            nextStage: hasDraftCompleted
               ? null
               : draft?.draftStage < 6
                  ? draft?.draftStage + 1
                  : null

         }),
      );
   } catch (error) {
      console.log(error);
      return next(error);
   }
}
export async function getSingleDraftOrProperty(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const todayDate = moment.utc(new Date()).startOf('date').toDate();
   const user = req.user as ISessionUser;
   try {
      const draftId = validateObjectId(req.params.propertyId);

      const draftOrProperty = await Property.findOne({
         _id: draftId,
         hostId: user._id,
      })

      if (!draftOrProperty) {
         throw new ApiError(404, 'No property found with provided id');
      }

      const [anyReservation, draftOrPropertyPrice, draftOrPropertyRules] = await Promise.all([
         Reservation.findOne({
            propertyId: draftId,
            checkOutDate: { $gte: todayDate },
            status: { $ne: 'cancelled' },
         }).select('_id'),
         Price.findById(draftOrProperty.price),
         PropertyRules.findById(draftOrProperty.propertyRules),
      ]);

      const stages = generateDraftOrPropertyCheckpoints(
         draftOrProperty,
         draftOrPropertyPrice,
         draftOrPropertyRules,
      );

      let completedStages = null
      let hasDraftCompleted = draftOrProperty.visibility === "published"

      if (draftOrProperty.visibility === "draft") {
         completedStages = draftOrProperty.draftStage
         hasDraftCompleted = completedStages === 6
      }

      return res.status(200).json(
         new ApiResponse(200, 'draft fetched successfully', {
            exists: true,
            stages: stages,
            completedStages,
            isComplete: hasDraftCompleted,
            visibility: draftOrProperty.visibility,
            hasActiveBooking: !!anyReservation,
         }),
      );
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function deletePropertyById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   const { reason = 'Host decide to delete property' } = req.body
   const now = moment.utc(new Date()).startOf('date').toDate();

   try {
      const propertyId = validateObjectId(req.params.propertyId);

      const filter = {
         $or: [
            { checkInDate: { $gt: now } },
            { checkInDate: { $lte: now }, checkOutDate: { $gte: now } }
         ]
      }
      const anyReservation = await Reservation.findOne({
         hostId: user._id,
         propertyId,
         ...filter
      }).select('_id');


      if (anyReservation) {
         throw new ApiError(
            409,
            'This property cannot be deleted as it has active bookings or upcomming reservations.',
         );
      }

      await withMongoTransaction(async (session) => {
         const targetPropertyToDelete = await Property.findOne({
            _id: propertyId,
            hostId: user._id,
         }).session(session);

         if (!targetPropertyToDelete) {
            throw new ApiError(400, 'No Property found to delete');
         }

         if (targetPropertyToDelete.visibility === 'draft') {

            const verification = targetPropertyToDelete.verification;

            if (verification.status === 'pending') {
               throw new ApiError(
                  400,
                  'This draft cannot be deleted as it is currently under review. Please wait for the verification process to complete.',
               );
            }

            const targetProperty = Property.deleteOne({ _id: propertyId, hostId: user._id, }).session(session);
            const targetPrice = Price.deleteOne({ _id: targetPropertyToDelete.price, }).session(session);
            const targetPropertyRules = PropertyRules.deleteOne({ _id: targetPropertyToDelete.propertyRules, }).session(session);

            const gallery = targetPropertyToDelete.gallery
            const document = targetPropertyToDelete?.verification?.documents || []
            await Promise.all(
               [
                  targetProperty, targetPrice, targetPropertyRules,
                  syncAndDeleteFiles({ existingFiles: gallery, incomingFiles: [], session }),
                  syncAndDeleteFiles({ existingFiles: document, incomingFiles: [], session }),
               ])

            return
         }


         targetPropertyToDelete.status = PROPERTY_STATUS.DELETED
         targetPropertyToDelete.statusMeta.push({
            previousStatus: targetPropertyToDelete.status,
            newStatus: PROPERTY_STATUS.DELETED,
            changedBy: {
               userId: req.user._id,
               role: 'user',
            },
            timestamp: new Date(),
            reason: reason,
         });

         if (targetPropertyToDelete.statusMeta.length > 10) {
            targetPropertyToDelete.statusMeta = targetPropertyToDelete.statusMeta.slice(-10);
         }

         await targetPropertyToDelete.save({ session })

      })

      return res.json(
         new ApiResponse(200, 'Property listing deleted successfully.'),
      );
   } catch (err) {
      console.log({ err });

      next(err);
   }
}

export async function makeRequestForApproval(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;

   try {
      const draftId = validateObjectId(req.params.draftId);

      // Find the draft property

      await withMongoTransaction(async (session) => {
         const draft = await Property.findOne({
            _id: draftId,
            hostId: user._id,
            visibility: 'draft',
         }).session(session);

         if (!draft) {
            throw new ApiError(
               400,
               'No draft available for review submission.',
            );
         }
         // Check if draft stage is completed

         if (draft.draftStage !== 6) {
            throw new ApiError(
               400,
               'Please complete all 6 checkpoints before submitting this draft for approval.',
            );
         }
         if (draft.verification.status != 'open') {
            throw new ApiError(
               400,
               `Your property documents are marked as ${draft.verification.status} and currently under review. Please contact admin for more details.`,
            );
         }

         draft.verification.status = 'pending';
         await draft.save({ session });

         const adminUserId = await User.findOne({ role: { $eq: "admin" } }).select('_id')

         const payload1 = createRecipient('inApp', {
            redirectKey: "new-property-request",
            metadata: { propertyId: String(draft._id) },
            userId: String(adminUserId._id),
            title: "Approval Request",
            message: `Approval Request: "${draft.title}" has been submitted and awaits your review.`,
            visibleToRoles: ['admin'],
         });

         dispatchNotification({ recipients: [payload1] });
      })

      return res.json(
         new ApiResponse(
            200,
            'Property sent for approval. Kindly be patient, our inspector is verifying your property details and documents.',
         ),
      );
   } catch (err) {
      next(err);

   }
}

export async function togglePropertyStatus(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const status = req.query?.status as 'active' | 'inactive';
   const allowedStatus = ['active', 'inactive'];


   try {
      const propertyId = validateObjectId(req.params.propertyId);
      const user = req.user as ISessionUser;

      const sessionUser = await User.findById(user._id).select('status')

      if (sessionUser.status === "suspended") {
         throw new ApiError(
            409,
            'Your account is currently suspended. Please contact our support team for assistance.'
         )
      }
      if (!allowedStatus.includes(status)) {
         throw new ApiError(
            400,
            'Invalid status. Please provide either "active" or "inactive".',
         );
      }


      const targetProperty = await Property.findOne({
         _id: propertyId,
         hostId: user._id,
         visibility: "published"
      })

      if (!targetProperty) {
         throw new ApiError(400, 'No property found to update status.');
      }


      if (status === targetProperty.status) {
         throw new ApiError(
            400,
            `Property is already ${status}. No change needed.`,
         );
      }

      const { hasOperationSuccess, status: responseStatus } = await targetProperty.modifyStatus(status, "host", user._id, "");


      if (responseStatus == "inactive") {

         if (!hasOperationSuccess) {

            throw new ApiError(409, `This property cannot be set to inactive because it has active bookings. future booking has been closed for this property, You can mark it as inactive after the last reservation passed.`)

         }
      }


      return res.json(
         new ApiResponse(
            200,
            `Property status updated to ${status} successfully.`,
         ),
      );
   } catch (err) {
      return next(err);
   }
}
export async function toggleBookingStatus(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   const status = req.query.status === 'true';
   try {
      const propertyId = validateObjectId(req.params.propertyId);

      // Validate presence and type of status
      if (
         typeof req.query.status !== 'string' ||
         (req.query.status !== 'true' && req.query.status !== 'false')
      ) {
         throw new ApiError(
            400,
            'Invalid status. Please provide a valid boolean string: "true" or "false".',
         );
      }

      const filter = {
         _id: propertyId,
         visibility: 'published',
         hostId: user._id,
         status: { $ne: 'inactive' }
      };

      const update = { isBookable: status };
      const options = {
         new: true,
      };

      const updatedProperty = await Property.findOneAndUpdate(
         { ...filter, isBookable: { $ne: status } },
         update,
         options
      );

      if (!updatedProperty) {
         const existingProperty = await Property.findOne({ _id: propertyId, hostId: user._id });
         if (!existingProperty) {
            throw new ApiError(404, 'Property not found or not accessible for updating booking status.');
         }
         if (existingProperty.status === 'inactive') {
            throw new ApiError(409, 'Booking updates are not permitted while the property is inactive.');
         }
         throw new ApiError(409, `Property booking status is already set to "${status}". No changes were made.`);
      }
      return res.status(200).json(
         new ApiResponse(
            200,
            `Property booking status successfully updated to "${status}".`,
         ),
      );
   } catch (err) {
      return next(err);
   }
}

export async function getHostPropertyListByFilter(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sessionUser = req.user as ISessionUser;
   const { pagination, search, sort } = res.locals;

   try {
      const { status } = req.query;
      const filter: {
         status?: PropertyStatusType | any;
         hostId: mongoose.Types.ObjectId;
         visibility?: 'published' | 'draft';
      } = { hostId: sessionUser._id, status: { $ne: PROPERTY_STATUS.DELETED } };

      // const user = await User.findById(sessionUser._id).select('status')
      switch (status) {
         case 'drafts': {
            filter.visibility = 'draft';
            filter.status = 'inactive';

            break;
         }
         case 'active-published': {
            filter.visibility = 'published';
            filter.status = 'active';

            break;
         }
         case 'inactive-published': {
            filter.visibility = 'published';
            filter.status = 'inactive';
            break;
         }
         case 'all-published': {
            filter.visibility = 'published';
            break;
         }

         case 'all': {
            break;
         }
         default:
            throw new ApiError(
               400,
               'please provide a valid status either drafts | active-published | inactive-published | all-published | all ',
            );
      }
      const query = await commonDraftService.getPropertyOrDraftList(
         filter,
         false,
         { ...search, ...sort },
         pagination,
      );
      const filterAllProperties = query.property;
      const countOfAllFilterProperties = query.totalCount;

      const result = formatPaginationResponse(
         filterAllProperties,
         countOfAllFilterProperties,
         pagination,
      );
      return res.json(result);
   } catch (err) {
      return next(err);
   }
}


export const getPropertyOrDraftPreview = async (req, res: Response, next) => {

   const currency = res.locals.currency
   const user = req.user as ISessionUser;
   try {
      const id = validateObjectId(req.params.propertyId);
      const filter: {
         _id: mongoose.Types.ObjectId;
         visibility?: 'published' | 'draft';
         hostId?: mongoose.Types.ObjectId;
      } = {
         _id: id,
         hostId: user?._id,
      };


      const property = await commonPropertyService.getSinglePropertyByFilter(filter, user?._id, currency);

      const wishlist = await Wishlist.findOne({ userId: user?._id, propertyId: id }).select('_id')



      if (!property) {
         throw new ApiError(404, 'No property found');
      }

      return res
         .status(200)
         .json(
            new ApiResponse(
               200,
               'Property preview fetched successfully',
               {
                  ...property, liked: !!wishlist
               },
            ),
         );
   } catch (err) {
      console.log(err);
      next(err);
   }
};



