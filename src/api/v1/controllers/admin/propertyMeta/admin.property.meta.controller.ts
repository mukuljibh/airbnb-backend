import { Response, Request, NextFunction } from 'express';
import { Category } from '../../../models/category/category';
import { Amenities } from '../../../models/property/amenities';
import { deepFilterObject } from '../../../utils/mutation/mutation.utils';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { AmenitiesTag } from '../../../models/property/amenitiesTag';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { Property } from '../../../models/property/property';
import mongoose from 'mongoose';
import { IUser } from '../../../models/user/types/user.model.types';
import { userEmitter } from '../../../events/user/user.emitter';

export async function addCategory(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { name, image, description } = req.body;
   try {
      if (!name || !image) {
         res.status(400).json({
            message: 'please provide at least name and image to add a category',
         });
         return;
      }
      // Check if a category with the same name already exists
      const existingCategory = await Category.findOne({
         name: { $regex: name, $options: 'i' },
      });
      if (existingCategory) {
         res.status(409).json({
            message: 'A category with this name already exists',
         });
         return;
      }

      await Category.create(deepFilterObject({ name, image, description }));
      res.status(201).json({ message: 'Category added successfully' });
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function getCategoryById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const categoryId = validateObjectId(req.params.categoryId);
      const category = await Category.findById(categoryId);
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
         res.status(400).json({
            message:
               'please provide at least name and image to update a category',
         });
         return;
      }
      const category = await Category.findByIdAndUpdate(
         { _id: categoryId },
         { name, image, description },
      );
      if (!category) {
         res.status(404).json({
            message: 'No category found to update',
         });
         return;
      }
      res.status(201).json({ message: 'Category updated successfully' });
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function deleteCategory(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const categoryId = validateObjectId(req.params.categoryId);
      const category = await Category.findOneAndDelete(categoryId);
      // Check if a category with the same name already exists
      if (!category) {
         throw new ApiError(404, 'No Category found to delete');
      }

      await Property.updateMany(
         { category: categoryId },
         { category: undefined },
      );
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
   try {
      const { title, amenities, description } = req.body;

      const amenitiesTag = await AmenitiesTag.create({ title, description });
      const amenitiesArr = amenities.reduce((acc, { title, icon }) => {
         acc.push({ tag: amenitiesTag._id, title, icon });
         return acc;
      }, []);
      const newAmenities = await Amenities.insertMany(amenitiesArr);
      res.status(201).json(
         new ApiResponse(200, 'Amenities created Successfully.', newAmenities),
      );
   } catch (err) {
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
}

export async function addAmenity(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const tagId = validateObjectId(req.params.tagId);
      const { title, icon } = req.body;

      if (!title || !icon) {
         throw new ApiError(400, 'title and icon are required simultaneously');
      }
      const amenityTag = await AmenitiesTag.findById(tagId);
      if (!amenityTag) {
         throw new ApiError(
            400,
            'No parent tag available to add this unit amenity',
         );
      }
      await Amenities.create({ title, icon, tag: amenityTag._id });

      res.status(201).json(
         new ApiResponse(
            200,
            `Amenities added inside ${amenityTag.title} successfully.`,
         ),
      );
   } catch (err) {
      console.log(err);
      next(err);
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

export async function deleteAmenityByTagId(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const tagId = validateObjectId(req.params.tagId);
      const amenityTag = await AmenitiesTag.findByIdAndDelete(tagId);

      if (!amenityTag) {
         throw new ApiError(404, 'No Amenity found for requested amenity id');
      }

      const amenitiesWithTag = await Amenities.find({ tag: tagId }).select(
         '_id',
      );
      const amenityIds = amenitiesWithTag.map((amenity) => amenity._id);

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

      deletedItems?.forEach((id) => {
         bulkOperation.push({
            deleteOne: { filter: { _id: new mongoose.Types.ObjectId(id) } },
         });
      });

      newItems?.forEach((item) => {
         bulkOperation.push({
            insertOne: {
               document: { tag: tagId, ...item },
            },
         });
      });

      const result = await Amenities.bulkWrite(bulkOperation);

      if (deletedItems.length > 0) {
         await Property.updateMany(
            { amenities: { $in: deletedItems } },
            { $pullAll: { amenities: deletedItems } },
         );
      }
      res.status(201).json(
         new ApiResponse(
            201,
            'amenities updation perform successfully',
            result,
         ),
      );
   } catch (err) {
      next(err);
   }
}

export async function approveUserDraft(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const propertyId = validateObjectId(req.params.propertyId);
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
            'verification.reason'?: string;
            visibility?: 'draft' | 'published';
         };
         $unset: { draftStage: 1 };
      }> = {
         $set: {
            'verification.status': status,
         },
      };

      if (status === 'verified') {
         updateQuery.$set.visibility = 'published';
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

      if (status === 'rejected' || status === 'required_action') {
         return res.status(200).json({
            message: `Property documents have been marked as  ${status}.`,
            reason,
         });
      }
      const user = property.hostId;
      if (status === 'verified') {
         userEmitter.emit('user:property-list', {
            type: 'PROPERTY_LISTING',
            destination: user?.email || user?.contactEmail,
            replacement: {
               name: `${user.firstName} ${user.lastName}`,
               propertyTitle: property.title,
            },
            userId: user._id,
            propertyId: property._id,
         });
      }
      res.status(200).json({
         message: `Property status updated to "${status}". The host can manage their property accordingly.`,
         propertyId: propertyId,
         newStatus: status,
      });
   } catch (err) {
      next(err);
   }
}
