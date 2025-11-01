import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { CategoryModel } from '../../../models/category/category';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { User } from '../../../models/user/user';
import { PipelineStage } from 'mongoose';
import { AmenitiesTag } from '../../../models/property/amenity/amenitiesTag';
import { PROPERTY_STATUS } from '../../../models/property/propertyAttributes/propertyAttributes';

export async function getAllAmenitiesGroupByTag(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sessionUser = req.user as ISessionUser;
   try {
      const user = await User.findById(sessionUser?._id).select('role');
      const isAdmin = user?.role?.includes('admin');
      const matchFilter = isAdmin ? {} : { 'status': 'active' };

      const pipeline: PipelineStage[] = [
         {
            $match: matchFilter
         },
         {
            $lookup: {
               from: "amenities",
               localField: "_id",
               foreignField: "tag",
               pipeline: [
                  {
                     $lookup: {
                        from: "properties",
                        localField: "_id",
                        foreignField: "amenities",
                        as: "result",
                        pipeline: [{ $limit: 1 }]
                     }

                  },
                  {
                     $addFields: {
                        isInUse: { $gt: [{ $size: "$result" }, 0] }
                     }
                  },
                  {
                     $project: {
                        title: 1,
                        description: 1,
                        icon: 1,
                        isInUse: 1
                     }
                  }
               ],
               as: 'items'
            }
         },
         {
            $project: {
               _id: 0,
               tagId: "$_id",
               status: 1,
               title: 1,
               description: 1,
               items: 1,
               isInUse: {
                  $anyElementTrue: {
                     $map: {
                        input: "$items",
                        as: "item",
                        in: "$$item.isInUse"
                     }
                  }
               }
            },
         },
      ]
      const amenties = await AmenitiesTag.aggregate(pipeline)

      return res.json(
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
   const { requestOrigin } = res.locals.sessionOptions

   const sortFilter = {}
   const projectFilter: Record<string, number> = {
      propertyStats: 0,
      numberOfPropertiesRegistered: 0
   }
   try {
      const pipe: PipelineStage[] = []
      const filter = {}

      if (["guest", "host"].includes(requestOrigin)) {
         sortFilter['numberOfPropertiesRegistered'] = -1
         filter['visibility'] = "published"
      }

      if (requestOrigin === "admin") {
         sortFilter['createdAt'] = -1
      }
      if (requestOrigin != 'admin') {
         filter['status'] = PROPERTY_STATUS.ACTIVE
      }
      pipe.push({
         $lookup: {
            from: "properties",
            localField: "_id",
            foreignField: "category",
            pipeline: [
               ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
               { $count: "count" }
            ],
            as: "propertyStats"
         }
      });

      pipe.push({
         $addFields: {
            numberOfPropertiesRegistered: {
               $ifNull: [{ $arrayElemAt: ["$propertyStats.count", 0] }, 0]
            },
            isInUse: { $gt: [{ $ifNull: [{ $arrayElemAt: ["$propertyStats.count", 0] }, 0] }, 0] }
         }
      });

      pipe.push({ $sort: sortFilter })

      if (requestOrigin != 'admin') {
         projectFilter.isInUse = 0
      }

      pipe.push({
         $project: projectFilter
      })


      const categories = await CategoryModel.aggregate(pipe)

      return res.status(200).json(
         new ApiResponse(200, 'Categories fetched successfully', categories),
      );
   } catch (err) {
      console.log(err);

      return next(err);
   }
}
