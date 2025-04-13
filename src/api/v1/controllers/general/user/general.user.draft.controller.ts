import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import mongoose, { HydratedDocument } from 'mongoose';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { Property } from '../../../models/property/property';
import { Price } from '../../../models/price/price';
import { PropertyRules } from '../../../models/property/propertyRules';
import { IProperty } from '../../../models/property/types/property.model.types';
import { generateDraftOrPropertyCheckpoints } from './utils/general.user.draft.helper';
import { storeCheckpointData } from './utils/general.user.draft.helper';
import { Reservation } from '../../../models/reservation/reservation';
import _ from 'lodash';
import moment from 'moment';
// import { deepFilterObject } from '../../../utils/mutation/mutation.utils';
export async function saveCheckpointDraft(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const draftId = req.params.draftId;
   const user = req.user as ISessionUser;
   try {
      // const dbUser = await User.findById(user.id);
      // if (dbUser.verification.status != 'verified') {
      //    throw new ApiError(
      //       400,
      //       'KYC verification required. Please complete your KYC verification to proceed with property publishing.',
      //    );
      // }
      const { stage } = req.body;
      // Using stage directly as the checkpoint number
      let draft: HydratedDocument<IProperty>;

      // Determine if it's a new draft or an existing one
      if (draftId === 'new') {
         draft = new Property({
            draftStage: 0, // Initialize with 0 to indicate no checkpoints completed
         });
      } else if (mongoose.isValidObjectId(draftId)) {
         draft = await Property.findOne({
            _id: draftId,
            hostId: user._id,
            visibility: 'draft',
         });
         if (!draft) {
            throw new ApiError(400, 'No draft found to update');
         }
      } else {
         throw new ApiError(400, 'Invalid id');
      }

      // Validate draft stage
      if (draft.visibility === 'published') {
         throw new ApiError(
            400,
            'Draft cannot be updated from here. Please use same route with patch method',
         );
      }

      if (draft.draftStage === 6) {
         throw new ApiError(400, 'Draft already complete');
      }

      if (stage <= draft.draftStage) {
         throw new ApiError(
            400,
            `Stage ${stage} already saved. Updates are not allowed.`,
         );
      }

      // Validate stage sequence
      if (stage > 1 && draft.draftStage !== stage - 1) {
         throw new ApiError(
            400,
            `Please save stage ${stage - 1} before saving ${stage}`,
         );
      }

      // Store stage data in respective schemas
      await storeCheckpointData(draft, stage, req);

      // Update the draft_stage to the current stage number
      draft.draftStage = stage;
      // draft.draftStage = stage;
      await draft.save();

      res.status(201).json(
         new ApiResponse(201, `Draft stage ${stage} saved successfully`, {
            draftId: draft._id,
            stage,
            isComplete: stage === 6,
            nextStage: stage === 6 ? 'Complete' : `stage ${stage + 1}`,
         }),
      );
   } catch (error) {
      console.log(error);
      next(error);
   }
}

export async function updateCheckpoint(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { stage } = req.body;
      const draftId = validateObjectId(req.params.draftId);
      const user = req.user as ISessionUser;

      const draft = await Property.findOne({
         _id: draftId,
         hostId: user._id,
      });
      if (!draft) {
         throw new ApiError(400, 'No draft available');
      }

      if (draft.visibility !== 'published') {
         // If it's not published, verify the stage is valid to update
         if (stage > draft.draftStage) {
            throw new ApiError(
               400,
               'Draft stages not yet completed. Please complete it first.',
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
         req.body = _.omit(req.body, [
            'propertyCity',
            'propertyCountry',
            'propertyState',
            'propertyTitle',
            'propertyZipcode',
            'propertyAddress',
            'propertyCoordinates',
            'propertyLandmark',
         ]);
         if (stage == 6) {
            throw new ApiError(
               400,
               'stage 6 not allowed for published property',
            );
         }
      }
      // Prepare new stage data
      await storeCheckpointData(draft, stage, req);
      await draft.save();

      res.status(201).json(
         new ApiResponse(201, `Stage ${stage} updated successfully`),
      );
   } catch (error) {
      console.log(error);
      next(error);
   }
}

export async function getSingleDraftOrProperty(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const draftId = validateObjectId(req.params.draftId);

      const draftOrProperty = await Property.findOne({
         _id: draftId,
         hostId: user._id,
      });
      if (!draftOrProperty) {
         throw new ApiError(400, 'No property available not allowed');
      }
      const draftOrPropertyPrice = await Price.findOne({
         _id: draftOrProperty.price,
      });
      const draftOrRules = await PropertyRules.findOne({
         _id: draftOrProperty.propertyRules,
      });

      const stages = await generateDraftOrPropertyCheckpoints(
         draftOrProperty,
         draftOrPropertyPrice,
         draftOrRules,
      );

      res.status(200).json(
         new ApiResponse(200, 'draft fetched successfully', {
            exists: true,
            stages: stages,
            completedStages: draftOrProperty.draftStage,
            visibility: draftOrProperty.visibility,
         }),
      );
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function deleteProperty(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const session = await mongoose.startSession();

   try {
      session.startTransaction();

      const propertyId = validateObjectId(req.params.propertyId);
      const user = req.user as ISessionUser;
      const targetPropertyToDelete = await Property.findOne({
         _id: propertyId,
         hostId: user._id,
      }).session(session);

      const todayDate = new Date();
      todayDate.setUTCHours(0, 0, 0, 0);

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
      }

      const anyReservation = await Reservation.findOne({
         propertyId,
         checkInDate: { $gte: todayDate },
         status: 'complete',
      }).session(session);

      if (anyReservation) {
         throw new ApiError(
            400,
            'This property cannot be deleted as it has active bookings.',
         );
      }

      // Ensure deletion queries are awaited before Promise.all
      const targetProperty = Property.deleteOne({
         _id: propertyId,
         hostId: user._id,
      }).session(session);
      const targetPrice = Price.deleteOne({
         _id: targetPropertyToDelete.price,
      }).session(session);
      const targetPropertyRules = PropertyRules.deleteOne({
         _id: targetPropertyToDelete.propertyRules,
      }).session(session);

      await Promise.all([targetProperty, targetPrice, targetPropertyRules]);

      await session.commitTransaction();
      res.status(200).json(
         new ApiResponse(200, 'Property listing deleted successfully.'),
      );
   } catch (err) {
      await session.abortTransaction();
      next(err);
   } finally {
      await session.endSession();
   }
}

export async function makeRequestForApproval(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const user = req.user as ISessionUser;
      const draftId = validateObjectId(req.params.draftId);

      // Find the draft property
      const draft = await Property.findOne({
         _id: draftId,
         hostId: user._id,
         visibility: 'draft',
      });

      if (!draft) {
         throw new ApiError(400, 'No draft available for review submission.');
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
      await draft.save();

      res.status(201).json(
         new ApiResponse(
            201,
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
   const todayDate = moment.utc(new Date()).startOf('date').toDate();

   try {
      const propertyId = validateObjectId(req.params.propertyId);
      const user = req.user as ISessionUser;

      if (!allowedStatus.includes(status)) {
         throw new ApiError(
            400,
            'Invalid status. Please provide either "active" or "inactive".',
         );
      }

      const targetProperty = await Property.findOne({
         _id: propertyId,
         hostId: user._id,
      });

      if (!targetProperty) {
         throw new ApiError(400, 'No property found to update status.');
      }

      if (targetProperty.verification.status !== 'verified') {
         throw new ApiError(
            400,
            'Your property has not been verified yet. Please contact the admin for updates.',
         );
      }

      if (status === 'inactive') {
         const anyReservation = await Reservation.findOne({
            propertyId,
            checkOutDate: { $gte: todayDate },
            status: 'complete',
         });

         if (anyReservation) {
            targetProperty.isBookable = false;
            await targetProperty.save();
            throw new ApiError(
               400,
               'This property cannot be set to inactive because it has active bookings. Bookings have been disabled temporarily for your convenience.',
            );
         }
      }

      if (status === targetProperty.status) {
         throw new ApiError(
            400,
            `Property is already ${status}. No change needed.`,
         );
      }

      targetProperty.status = status;
      await targetProperty.save();

      res.status(200).json(
         new ApiResponse(200, 'Property status updated successfully.'),
      );
   } catch (err) {
      next(err);
   }
}
