import { Response, Request, NextFunction } from 'express';
import { CategoryModel } from '../../../models/category/category';
import { Amenities } from '../../../models/property/amenity/amenities';
import { deepFilterObject } from '../../../utils/mutation/mutation.utils';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { AmenitiesTag } from '../../../models/property/amenity/amenitiesTag';
import { validateObjectId, withMongoTransaction } from '../../../utils/mongo-helper/mongo.utils';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { Property } from '../../../models/property/property';
import mongoose, { ClientSession, PipelineStage } from 'mongoose';
import { createRecipient, dispatchNotification } from '../../common/notifications/services/dispatch.service';
import * as commonPropertyService from "../../common/property/property.service"
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { extractPublicId } from '../../../../uploads/helpers/uploads.helper';
import * as commonDraftService from '../../common/property/property.service'
import UploadLogs from '../../../../uploads/models/uploadLogs';
import { releaseUploadResources, confirmUploadResources } from '../../../../uploads/services/upload.service';
import { UserFlagModel } from '../../../models/reports/userFlag';
import { PropertyStatusType } from '../../../models/property/types/property.model.types';
import { PROPERTY_STATUS } from '../../../models/property/propertyAttributes/propertyAttributes';
import { checkActiveReservation } from '../../common/reservation/services/reservation.service';
import { formatDate } from '../../../utils/dates/dates.utils';
import { IUser } from '../../../models/user/types/user.model.types';
import env from '../../../config/env';

export async function addCategory(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { name, image, description } = req.body;
   try {
      if (!name || !image) {
         return res.status(400).json({
            message: 'please provide at least name and image to add a category',
         });

      }
      // Check if a category with the same name already exists
      const existingCategory = await CategoryModel.findOne({
         name: { $regex: name, $options: 'i' },
      });
      if (existingCategory) {
         return res.status(409).json({
            message: 'A category with this name already exists',
         });

      }
      confirmUploadResources(image)
      const category = await CategoryModel.create(deepFilterObject({ name, image, description }));


      return res.status(201).json(new ApiResponse(201, 'Category added successfully.', category));
   } catch (err) {
      console.log(err);
      return next(err);
   }
}

export async function getCategoryById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const categoryId = validateObjectId(req.params.categoryId);
      const category = await CategoryModel.findById(categoryId);
      if (!category) {
         res.status(404).json({
            message: 'No category found',
         });
         return;
      }
      res.status(201).json(category);
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function updateCategory(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { name, image, description } = req.body;

   try {
      const categoryId = validateObjectId(req.params.categoryId);
      // Check if a category with the same name already exists
      if (!name || !image) {
         return res.status(400).json({
            message:
               'please provide at least name and image to update a category',
         });
      }
      const category = await CategoryModel.findByIdAndUpdate(
         categoryId,
         { name, image, description },
      );

      if (!category) {
         return res.status(404).json({
            message: 'No category found to update',
         });

      }

      releaseUploadResources(category.image)

      confirmUploadResources(image)

      return res.status(200).json({ message: 'Category updated successfully.' });
   } catch (err) {
      console.log(err);
      return next(err);
   }
}

export async function deleteCategory(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const categoryId = validateObjectId(req.params.categoryId);

      const anyPropertyExistOnCategory = await Property.findOne({ category: categoryId }).select("_id")

      if (anyPropertyExistOnCategory) {
         throw new ApiError(208, "Unable to delete category as it is used by other properties")
      }

      const category = await CategoryModel.findOneAndDelete({ _id: categoryId }).select("image");

      releaseUploadResources(category.image)
      // Check if a category with the same name already exists
      if (!category) {
         throw new ApiError(404, 'No Category found to delete');
      }


      res.status(200).json({ message: 'Category deleted successfully' });
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function addAmenities(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   let session: ClientSession | null
   try {
      const { title, amenities, description } = req.body;
      const publicIdsToKeep = []


      session = await mongoose.startSession()
      await session.withTransaction(async () => {

         const amenitiesTag = await AmenitiesTag.create([{ title, description }], { session });

         const amenitiesArr = amenities.reduce((acc, { title, icon }) => {
            const id = extractPublicId(icon)
            publicIdsToKeep.push(id)
            acc.push({ tag: amenitiesTag[0]._id, title, icon });
            return acc;
         }, []);

         const awaitingUploads = UploadLogs.deleteMany(
            { publicId: { $in: publicIdsToKeep } }
         ).session(session);

         const awaitingAmenitiesInserts = Amenities.insertMany(amenitiesArr, { session });

         await Promise.all([awaitingAmenitiesInserts, awaitingUploads])
      });

      res.status(201).json(
         new ApiResponse(200, 'Amenities created Successfully.'),
      );
   } catch (err) {
      console.log(err);

      if (err.code == 11000) {
         next(
            new ApiError(
               400,
               'amenities tag title already exists please choose other name for the title',
            ),
         );
         return;
      }
      next(err);
   }
   finally {
      if (session) {
         session.endSession()
      }
   }
}


export async function toggleAmenityTagStatus(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const status = req.query.status as 'active' | 'inactive';
      const allowedStatus = ['active', 'inactive'];

      try {
         const amenityTagId = validateObjectId(req.params.tagId);

         // const inUse = await checkAmenityTagIsInUseOrNot(amenityTagId)
         // if (inUse) {
         //    throw new ApiError(409, "You cannot change the status of this tag while it's in use by active listings.")
         // }

         if (!allowedStatus.includes(status)) {
            throw new ApiError(
               400,
               'Invalid status. Please provide either active | inactive',
            );
         }
         const targetAmenityTag = await AmenitiesTag.findOne({
            _id: amenityTagId,
         });
         if (!targetAmenityTag) {
            throw new ApiError(400, 'No tag found to update status');
         }
         if (status === targetAmenityTag.status) {
            throw new ApiError(400, `amenity tag already ${status}`);
         }

         targetAmenityTag.status = status;
         await targetAmenityTag.save();

         res.status(200).json(
            new ApiResponse(200, 'amenity tag status updated successfully'),
         );
      } catch (err) {
         next(err);
      }
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function deleteTagAndAllAmenitiesByTagId(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const tagId = validateObjectId(req.params.tagId);
      const amenitiesWithTag = await Amenities.find({ tag: tagId }).select(
         '_id icon',
      );

      const amenityTag = await AmenitiesTag.findByIdAndDelete(tagId);

      if (!amenityTag) {
         throw new ApiError(404, 'No Amenity found for requested amenity id');
      }


      const amenityIds = amenitiesWithTag.map((amenity) => amenity._id);

      const urls = amenitiesWithTag.map((x) => {
         return {
            url: x.icon
         }
      })

      await UploadLogs.create(urls)

      const deletedItems = await Amenities.deleteMany({ tag: tagId });

      if (amenityIds.length > 0) {
         await Property.updateMany(
            { amenities: { $in: amenityIds } },
            { $pullAll: { amenities: amenityIds } },
         );
      }
      res.status(200).json(
         new ApiResponse(200, 'Amenities deleted Successfully.', deletedItems),
      );
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function getAmenitiesByTagId(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const tagId = validateObjectId(req.params.tagId);
      const amenityTag = await AmenitiesTag.findById(tagId);
      if (!amenityTag) {
         throw new ApiError(400, 'no amenity tag found');
      }
      const items = await Amenities.find({ tag: tagId }).select(
         '_id title icon',
      );

      res.status(200).json(
         new ApiResponse(200, 'Amenities fetched successfully', {
            amenityTag,
            items,
         }),
      );
   } catch (err) {
      next(err);
   }
}
export async function updateOrDeleteAmenitiesByTagId(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const tagId = validateObjectId(req.params.tagId);

      const { title, description, deletedItems, newItems } = req.body;

      const updatedtag = await AmenitiesTag.findByIdAndUpdate(
         { _id: tagId },
         { title, description },
      );

      if (!updatedtag) {
         throw new ApiError(400, 'No parent tag found to update');
      }

      const bulkOperation = [];

      if (deletedItems?.length > 0) {
         const usedAmenities = await Property.find({
            amenities: { $in: deletedItems },
         }).distinct('amenities');

         const usedSet = new Set(usedAmenities.map(String));

         const amenitiesToRemove = await Amenities.find({ _id: { $in: deletedItems } }).select('icon')

         const urls = amenitiesToRemove.map((item) => {
            return { url: item.icon }
         })


         await UploadLogs.create(urls)

         for (const id of deletedItems) {
            if (usedSet.has(String(id))) {
               throw new ApiError(400, `Amenity with ID ${id} is in use by properties and cannot be deleted`);
            }
            bulkOperation.push({
               deleteOne: { filter: { _id: new mongoose.Types.ObjectId(id) } },
            });
         }
      }

      await UploadLogs.deleteMany({ publicId: { $in: newItems?.map(x => extractPublicId(x?.icon)) } })

      newItems?.forEach((item) => {
         bulkOperation.push({
            insertOne: {
               document: { tag: tagId, ...item },
            },
         });
      });

      await Amenities.bulkWrite(bulkOperation);

      if (deletedItems.length > 0) {
         await Property.updateMany(
            { amenities: { $in: deletedItems } },
            { $pullAll: { amenities: deletedItems } },
         );
      }
      return res.json(
         new ApiResponse(
            200,
            'amenities updation perform successfully',
         ),
      );
   } catch (err) {
      console.log(err);

      return next(err);
   }
}

export async function approveUserDraft(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const propertyId = validateObjectId(req.params.propertyId);
      const previousPropertyState = await Property.findOne({ _id: propertyId, visibility: 'draft' });

      if (!previousPropertyState) {
         throw new Error('Property not found or not in draft state.');
      }
      const { status, reason } = req.body;

      if (!['verified', 'rejected', 'required_action'].includes(status)) {
         throw new ApiError(
            400,
            'Invalid status. Please provide either "verified", "rejected", or "required_action".',
         );
      }

      if ((status === 'rejected' || status === 'required_action') && !reason) {
         throw new ApiError(
            400,
            'Reason is required for rejected or required_action status.',
         );
      }

      const updateQuery: Partial<{
         $set: {
            'verification.status': string;
            'verification.lastStatus'?: string;
            'verification.reason'?: string;
            visibility?: 'draft' | 'published';
            status?: 'active' | 'inactive';
         };
         $unset: { draftStage: 1 };
      }> = {
         $set: {
            'verification.status': status,
            // 'verification.lastStatus': previousPropertyState.verification.status,
         },
      };
      //last status done by admin 
      if (["rejected", "required_action"].includes(status)) {
         updateQuery.$set['verification.lastStatus'] = status
      }

      if (status === 'verified') {
         updateQuery.$set.visibility = 'published';
         updateQuery.$set.status = 'active';
         updateQuery.$unset = { draftStage: 1 };
      } else {
         updateQuery.$set['verification.reason'] = reason;
      }

      const property = await Property.findOneAndUpdate(
         { _id: propertyId, visibility: 'draft' },
         updateQuery,
         { new: true },
      ).populate<{ hostId: IUser }>('hostId');

      if (!property) {
         throw new ApiError(404, 'Property not found.');
      }


      const user = property.hostId;

      let payload;

      switch (status) {
         case 'verified':
            payload = createRecipient('both', {
               emailOptions: {
                  type: 'PROPERTY_LISTING_VERIFIED',
                  destination: user?.email || user?.contactEmail,
                  replacement: {
                     name: `${user.firstName} ${user.lastName}`,
                     propertyName: property.title,
                     date: formatDate(new Date(), true),

                  },
               },
               notificationOptions: {
                  redirectKey: "new-property-request",
                  metadata: { propertyId: String(propertyId) },
                  userId: String(user._id),
                  title: 'Your property has been listed!',
                  message: 'Your new property is now live and visible to travelers.',
                  visibleToRoles: ['host'],
               }
            })
            break

         case 'required_action':

            payload = createRecipient('both', {
               emailOptions: {
                  type: 'PROPERTY_REQUIRED_ACTION',
                  destination: user?.email || user?.contactEmail,
                  replacement: {
                     name: `${user.firstName} ${user.lastName}`,
                     propertyName: property.title,
                     actionUrl: `${env.HOST_URL}/properties/${propertyId}/edit`,
                     reason: property.verification.reason || "The property did not meet our listing standards.",
                     date: formatDate(new Date(), true),
                  },
               },
               notificationOptions: {
                  redirectKey: "new-property-request",
                  metadata: { propertyId: String(propertyId) },
                  userId: String(user._id),
                  title: 'Property Approval Requires Action',
                  message: `Your property "${property.title}" requires updates before it can be approved.`,
                  visibleToRoles: ['host'],
               }
            })
            break
         case 'rejected':
            payload = createRecipient('both', {
               emailOptions: {
                  type: 'PROPERTY_REJECTED',
                  destination: user?.email || user?.contactEmail,
                  replacement: {
                     name: `${user?.firstName} ${user?.lastName}`,
                     propertyName: property.title,
                     reason: property.verification.reason || "The property did not meet our listing standards.",
                     date: formatDate(new Date(), true),
                  },
               },
               notificationOptions: {
                  redirectKey: "new-property-request",
                  metadata: { propertyId: String(propertyId) },
                  userId: String(user._id),
                  title: 'Property Approval Rejected',
                  message: `Your property "${property.title}" has been rejected by the admin.`,
                  visibleToRoles: ['host'],
               }
            })
            break

      }

      dispatchNotification({ recipients: [payload] });

      return res.json(new ApiResponse(200, `Property documents have been marked as ${status}.`))

   } catch (err) {
      next(err);
   }
}

//get property by id of the property
export const getFullPropertyByIdForAdmin = async (req, res, next) => {
   const currency = res.locals.currency

   try {
      const id = validateObjectId(req.params.id);
      const result = await commonPropertyService
         .getSinglePropertyByFilter({ _id: id }, null, currency, '-category -createdAt -updatedAt -thumbnail');

      if (!result) {
         throw new ApiError(404, 'No property found');
      }

      const hasActiveReservation = await checkActiveReservation({ propertyId: id })

      return res.json(new ApiResponse(200, 'Property retrieved successfully', { ...result, hasActiveReservation }));
   } catch (err) {
      next(err);
   }
};

export async function getAdminPropertyListByFilter(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { pagination, search, sort } = res.locals;
   try {
      const { status, verificationStatus } = req.query;
      const filter: {
         status?: PropertyStatusType | any;
         visibility?: 'published' | 'draft';
         'verification.status'?: unknown;
      } = { 'verification.status': { $ne: 'open' }, status: { $ne: PROPERTY_STATUS.DELETED } };

      if (verificationStatus) {
         filter['verification.status'] = verificationStatus;
      }
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
         case 'suspended': {
            filter.visibility = 'published';
            filter.status = 'suspended';
            break;
         }

         case 'all-published': {
            filter.visibility = 'published';
            break;
         }

         case 'deleted': {
            filter.visibility = 'published';
            const groupedStatus = [PROPERTY_STATUS.PENDING_DELETION, PROPERTY_STATUS.DELETED]
            filter.status = { $in: groupedStatus };
            break;
         }

         case 'all': {
            throw new ApiError(400, 'status all not yet implemented');
         }
         default:
            throw new ApiError(
               400,
               'please provide a valid status either drafts | active-published | inactive-published | all-published | all | deleted ',
            );
      }

      const query = await commonDraftService.getPropertyOrDraftList(
         filter,
         true,
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
      res.json(result);
   } catch (err) {
      next(err);
   }
}

export async function changePropertyStateByAdmin(
   req: Request,
   res: Response,
   next: NextFunction
) {
   const { status, reason }: { status: 'suspended' | 'deleted' | 'unsuspended', reason: string } = req.body;

   try {
      const allowedStatuses: Array<typeof status> = ['suspended', 'deleted', 'unsuspended'];

      if (!allowedStatuses.includes(status)) {
         throw new ApiError(400, 'Only suspended, deleted, or unsuspended statuses are allowed.');
      }

      if (!reason?.trim()) {
         throw new ApiError(400, 'Reason is mandatory');
      }

      const propertyId = validateObjectId(req.params.propertyId);

      const targetProperty = await Property.findOne({
         _id: propertyId,
         visibility: 'published',
         status: { $ne: PROPERTY_STATUS.DELETED }
      })
         .select('title status statusMeta hostId')
         .populate<{ hostId: IUser }>({ path: 'hostId', select: 'firstName lastName email' })

      if (!targetProperty) {
         throw new ApiError(404, 'No property found to update status.');
      }

      const targetUser = targetProperty.hostId

      if (!targetUser) {
         throw new ApiError(404, 'Host user not found.');
      }

      const previousStatus = targetProperty.status;
      const lastStatusMeta = targetProperty.statusMeta?.at(-1);

      if (status === 'unsuspended' && ![PROPERTY_STATUS.SUSPENDED].includes(previousStatus as any)) {
         throw new ApiError(409, 'Unsuspend action is only allowed for suspended properties.');
      }

      const newStatus =
         PROPERTY_STATUS?.[status.toUpperCase()] ||
         lastStatusMeta?.previousStatus;

      if (previousStatus === newStatus) {
         throw new ApiError(409, `This property is already ${previousStatus}.`);
      }

      if (newStatus === PROPERTY_STATUS.DELETED) {
         const hasActiveReservation = await checkActiveReservation({ propertyId });
         if (hasActiveReservation) {
            throw new ApiError(409, 'This property has active reservations and cannot be deleted.');
         }
      }

      await withMongoTransaction(async (session) => {
         await commonPropertyService.changePropertyState({
            propertyId,
            userId: targetUser._id,
            newPropertyStatus: status,
            reason,
            role: 'admin',
            session
         });
      });

      const emailOptions = {
         userName: `${targetUser.firstName} ${targetUser.lastName}`,
         propertyName: targetProperty.title,
         date: formatDate(new Date()),
         deletedBy: 'admin',
         reason,
      };


      let payload
      if (status === 'deleted') {

         payload = createRecipient('email', {
            destination: targetUser.email,
            type: 'PROPERTY_DELETED',
            replacement: emailOptions,
         });
      }

      else if (status === 'suspended') {
         payload = createRecipient('both', {
            emailOptions: {
               destination: targetUser.email,
               type: 'PROPERTY_SUSPENSION',
               replacement: emailOptions,
            },
            notificationOptions: {
               userId: String(targetProperty.hostId._id),
               message: `Your property "${targetProperty.title}" has been suspended. It is currently not visible to guests.`,
               visibleToRoles: ['host'],
               title: `Property Suspended`,
               redirectKey: 'property-page',
               metadata: {
                  propertyId: String(targetProperty._id),
               }
            }
         });



      } else if (status === 'unsuspended') {

         payload = createRecipient('both', {
            emailOptions: {
               destination: targetUser.email,
               type: 'PROPERTY_UNSUSPENSION',
               replacement: emailOptions,
            },
            notificationOptions: {
               userId: String(targetProperty.hostId._id),
               message: `Your property "${targetProperty.title}" has been reinstated and is now visible to guests again.`,
               visibleToRoles: ['host'],
               title: `Property Reinstated`,
               redirectKey: 'property-page',
               metadata: {
                  propertyId: String(targetProperty._id),
               }
            }
         });
      }

      dispatchNotification({ recipients: [payload] });

      return res.json(new ApiResponse(200, `Property status updated to ${status} successfully.`));
   } catch (err) {
      next(err);
   }
}




export const getUserReportList = async (req: Request, res: Response, next: NextFunction) => {
   try {

      const { search, sort, pagination } = res.locals;
      const { sortDirection, sortField = 'createdAt' } = sort;
      const { searchTerm } = search;
      const { limit, startIndex } = pagination


      const searchRegex = new RegExp(searchTerm?.trim(), 'i');

      const pipeline: PipelineStage[] = [
         {
            $lookup: {
               from: 'users',
               localField: 'flaggingUserId',
               foreignField: '_id',
               pipeline: [
                  {
                     $project: {
                        fullName: { $concat: ['$firstName', ' ', '$lastName'] },
                        address: 1,
                        email: 1,
                        phone: '$phone.number',
                        profilePicture: 1

                     }
                  }
               ],
               as: 'flaggingUser'
            }
         },
         { $unwind: '$flaggingUser' },
         {
            $lookup: {
               from: 'properties',
               localField: 'propertyId',
               foreignField: '_id',
               pipeline: [
                  {
                     $project: {
                        title: 1,
                        thumbnail: 1,
                        gallery: 1,
                        location: 1
                     }
                  }
               ],
               as: 'flaggedPropertyDetails'
            }
         },
         { $unwind: '$flaggedPropertyDetails' },
         {
            $addFields: {
               concatSearch: {
                  $concat: ['$flaggedPropertyDetails.title', ' ', '$flaggingUser.fullName']
               }
            }
         }
      ];


      if (searchTerm?.trim()) {
         pipeline.push({
            $match: {
               $or: [
                  { 'flaggingUser.fullName': searchRegex },
                  { 'concatSearch': searchRegex },
                  { 'flaggingUser.email': searchRegex },
                  { 'flaggingUser.phone': searchRegex },
                  { 'flaggedPropertyDetails.title': searchRegex },
                  { 'flaggedPropertyDetails.location.city': searchRegex },
                  { 'flaggedPropertyDetails.location.address': searchRegex }

               ]
            }
         });
      }

      pipeline.push(
         { $sort: { [sortField]: sortDirection } },
         { $skip: startIndex },
         { $limit: limit }
      );

      pipeline.push({
         $project: {
            propertyId: 0,
            flaggableId: 0,
            concatSearch: 0
         }
      })

      const countPipeline = pipeline.filter(stage => !('$skip' in stage || '$limit' in stage || '$sort' in stage));
      countPipeline.push({ $count: 'total' });

      const [userReportList, countResult] = await Promise.all([
         UserFlagModel.aggregate(pipeline),
         UserFlagModel.aggregate(countPipeline),
      ]);
      const total = countResult[0]?.total || 0;

      const data = formatPaginationResponse(userReportList, total, pagination)
      return res.status(200).json(data);
   } catch (error) {
      console.log(error);
      next(error);
   }
};
