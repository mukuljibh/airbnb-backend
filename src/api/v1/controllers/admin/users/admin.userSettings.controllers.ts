import { Request, Response, NextFunction } from 'express';
import { User } from '../../../models/user/user';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { Property } from '../../../models/property/property';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { getHostAllPropertiesReviewsStatistics } from '../../../utils/aggregation-pipelines/agregation.utils';
import { ApiError } from '../../../utils/error-handlers/ApiError';

interface UserQueryParams {
   role?: string;
   page?: string;
   limit?: string;
   sortField?: string;
   sortOrder?: 'asc' | 'desc';
   searchTerm?: string;
}

export async function getUsersList(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const {
      role = 'all',
      page = '1',
      limit = '10',
      sortField = 'createdAt',
      sortOrder = 'asc',
      searchTerm = '',
   } = req.query as UserQueryParams;
   const sortDirection = sortOrder === 'desc' ? -1 : 1;
   const filterConditions: {
      role?: [string, string] | [string] | { $nin: string[] };
      $or?: unknown[];
      hasBasicDetails?: boolean;
   } = {};
   try {
      if (!['guest', 'host', 'all'].includes(role)) {
         throw new ApiError(400, 'provide role either guest | host | all');
      }

      // Exclude 'admin' role if all is provided or default
      filterConditions.role = { $nin: ['admin'] };
      filterConditions.hasBasicDetails = true;
      // Role filtering logic
      if (role !== 'all' && role !== 'admin') {
         if (role === 'guest') {
            filterConditions.role = ['guest'];
         } else {
            filterConditions.role = ['guest', 'host'];
         }
      }
      // Search functionality
      if (searchTerm && searchTerm.trim() !== '') {
         const escapedSearchTerm = searchTerm.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
         );

         filterConditions.$or = [
            { firstName: { $regex: escapedSearchTerm, $options: 'i' } },
            { lastName: { $regex: escapedSearchTerm, $options: 'i' } },
            { email: { $regex: escapedSearchTerm, $options: 'i' } },
            { 'address.country': { $regex: escapedSearchTerm, $options: 'i' } },
            { 'address.state': { $regex: escapedSearchTerm, $options: 'i' } },
            { 'address.city': { $regex: escapedSearchTerm, $options: 'i' } },
            { 'address.pincode': { $regex: escapedSearchTerm, $options: 'i' } },
            { 'phone.number': { $regex: escapedSearchTerm, $options: 'i' } },
         ];
      }

      // Fetch users
      const users = await User.aggregate([
         { $match: filterConditions },

         {
            $project: {
               firstName: 1,
               lastName: 1,
               address: 1,
               email: 1,
               phone: 1,
               role: 1,
               provider: 1,
               createdAt: 1,
               dob: 1,
               isSoftDelete: 1,
               hasEmailVerified: 1,
               hasPhoneVerified: 1,
            },
         },
         { $sort: { [sortField]: sortDirection } },
         { $skip: (parseInt(page) - 1) * parseInt(limit) },
         { $limit: parseInt(limit) },
      ]);

      const totalUsers = await User.countDocuments(filterConditions);

      res.status(200).json({
         statusCode: 200,
         success: true,
         message: 'Users fetched successfully.',
         data: users,
         currentPage: parseInt(page),
         totalPages: Math.ceil(totalUsers / parseInt(limit)),
         totalUsers,
      });
   } catch (err) {
      next(err);
   }
}

export async function updateUserById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { id } = req.params;
      const updateData = req.body;

      // Find user and update
      const updatedUser = await User.findByIdAndUpdate(id, updateData, {
         new: true, // Return the updated document
         runValidators: true, // Ensure validation rules apply
      });

      if (!updatedUser) {
         return res.status(404).json({
            statusCode: 404,
            success: false,
            message: 'User not found.',
         });
      }

      res.status(200).json({
         statusCode: 200,
         success: true,
         message: 'User updated successfully.',
         data: updatedUser,
      });
   } catch (err) {
      console.error(err);
      next(err);
   }
}

export async function deleteUserById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { id } = req.params;

      // Find user and delete
      const deletedUser = await User.findByIdAndDelete(id);

      if (!deletedUser) {
         return res.status(404).json({
            statusCode: 404,
            success: false,
            message: 'User not found.',
         });
      }

      res.status(200).json({
         statusCode: 200,
         success: true,
         message: 'User deleted successfully.',
      });
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
      const hostId = validateObjectId(req.params.hostId);
      const hostDetails = await User.findOne({ _id: hostId }).select(
         'firstName lastName email bio languages profilePicture address role hasEmailVerified hasPhoneVerified createdAt isSoftDelete',
      );

      const publishedProperties = await Property.aggregate([
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

      const allReviewsDetails = await getHostAllPropertiesReviewsStatistics(
         hostId,
         {
            limit: 5,
         },
      );
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
