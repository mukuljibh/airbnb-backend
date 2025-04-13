import { Request, Response, NextFunction } from 'express';
import { Amenities } from '../../../models/property/amenities';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { Category } from '../../../models/category/category';
import { getUserFromDb } from '../../../utils/aggregation-pipelines/agregation.utils';
import { ISessionUser } from '../../../models/user/types/user.model.types';

export async function getAllAmenities(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sessionUser = req.user as ISessionUser;
   try {
      const user = await getUserFromDb(sessionUser._id);
      const isAdmin = user?.role?.includes('admin');
      const matchFilter = isAdmin
         ? {}
         : {
              'tag.status': 'active',
           };
      const amenties = await Amenities.aggregate([
         {
            $lookup: {
               from: 'amenitiestags',
               localField: 'tag',
               foreignField: '_id',
               as: 'tag',
            },
         },
         {
            $match: matchFilter,
         },
         {
            $group: {
               _id: {
                  _id: { $first: '$tag._id' },
                  title: { $first: '$tag.title' },
                  status: { $first: '$tag.status' },
                  description: { $first: '$tag.description' },
               },
               items: {
                  $push: {
                     _id: '$_id',
                     title: '$title',
                     icon: '$icon',
                  },
               },
            },
         },
         {
            $project: {
               _id: 0,
               tagId: '$_id._id',
               status: '$_id.status',
               title: '$_id.title',
               description: '$_id.description',
               items: { $sortArray: { input: '$items', sortBy: { title: 1 } } },
               sortOrder: {
                  $cond: {
                     if: { $eq: ['$_id.title', 'others'] },
                     then: 999,
                     else: 1,
                  },
               },
            },
         },
         { $sort: { sortOrder: 1, title: 1 } },
         {
            $project: {
               tagId: 1,
               status: 1,
               title: 1,
               description: 1,
               items: 1,
            },
         },
      ]);

      res.status(200).json(
         new ApiResponse(200, 'Amenities fetched successfully', amenties),
      );
   } catch (err) {
      next(err);
   }
}

export async function getCategories(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const categories = await Category.find();
      res.status(200).json(
         new ApiResponse(200, 'Categories fetched successfully', categories),
      );
      return;
   } catch (err) {
      next(err);
   }
}
