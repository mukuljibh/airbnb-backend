import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { Property } from '../../../models/property/property';
import { Price } from '../../../models/price/price';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import {
   PropertyFilter,
   PropertyService,
} from './utils/general.properties.filter.helper';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { Reviews } from '../../../models/property/reviews';
import { Reservation } from '../../../models/reservation/reservation';
import moment from 'moment';

export async function getFilterProperties(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const propertyService = new PropertyService();
      const filters = req.query as PropertyFilter;
      const user = req.user as ISessionUser;

      const result = await propertyService.getFilteredProperties(
         filters,
         res.locals.pagination,
         user?._id,
      );

      res.status(200).json(result);
   } catch (err) {
      next(err);
   }
}

export async function getPropertiesReviewsById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const pagesAttr = res.locals.pagination;

   try {
      const propertyId = validateObjectId(req.params.propertyId);

      const [totalReviewCount, reviews] = await Promise.all([
         Reviews.countDocuments({ propertyId }),
         Reviews.find({ propertyId })
            .skip(pagesAttr.startIndex)
            .limit(pagesAttr.limit)
            .lean(),
      ]);
      const result = formatPaginationResponse(
         reviews,
         totalReviewCount,
         pagesAttr,
      );
      res.status(200).json(result);
   } catch (err) {
      next(err);
   }
}

export async function getPropertiesPricingById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const query: Partial<{
         checkIn: Date;
         checkOut: Date;
         child: string;
         adult: string;
      }> = req.query;

      const checkIn = query.checkIn as Date;
      const checkOut = query.checkOut as Date;

      const adult = Number(query.adult);
      const child = Number(query.child);
      const propertyId = validateObjectId(req.params.propertyId);
      if (checkIn > checkOut) {
         throw new ApiError(
            400,
            'Check-in date cannot be greater than check-out date.',
         );
      }

      const property = await Property.findOne(
         { _id: propertyId },
         { _id: 1, price: 1 },
      );
      if (!property) {
         throw new ApiError(404, 'Property not found.');
      }
      const isDatesAvailable = await property.checkAvailableDate(
         checkIn,
         checkOut,
      );
      if (!isDatesAvailable) {
         return res
            .status(208)
            .json(
               new ApiResponse(
                  208,
                  'Reservation pricing not available for the provided date range.',
               ),
            );
      }
      const price = await Price.findById(property.price);
      if (!price) {
         throw new ApiError(
            500,
            'Pricing information not found for the specified property.',
         );
      }
      const total = await price.calculateTotalPrice(
         checkIn,
         checkOut,
         child,
         adult,
      );

      res.status(200).json(total);
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function propertySearch(req: Request, res: Response) {
   const { query } = req.query;
   if (!query) return res.json([]);

   try {
      const properties = await Property.aggregate([
         {
            $search: {
               index: process.env.MONGODB_SEARCH_INDEX || 'default',
               compound: {
                  should: [
                     {
                        text: {
                           query: query.toString(),
                           path: 'location.city',

                           fuzzy: {
                              maxEdits: 1,
                              prefixLength: 3,
                           },
                           score: { boost: { value: 4 } },
                        },
                     },
                     {
                        text: {
                           query: query.toString(),
                           path: 'location.state',

                           fuzzy: {
                              maxEdits: 1,
                              prefixLength: 4, // Improve search performance
                           },
                           score: { boost: { value: 3 } },
                        },
                     },
                     {
                        text: {
                           query: query.toString(),
                           path: 'location.country',
                           score: { boost: { value: 2 } },
                        },
                     },

                     {
                        text: {
                           query: query.toString(),
                           path: 'title',
                           fuzzy: {
                              maxEdits: 2,
                              prefixLength: 3,
                           },
                           score: { boost: { value: 1 } },
                        },
                     },
                  ],
               },
               highlight: {
                  path: [
                     'title',
                     'location.city',
                     'location.country',
                     'location.state',
                  ],
               },
            },
         },
         {
            $match: {
               status: 'active',
            },
         },
         {
            $project: {
               title: 1,
               location: 1,
               highlights: { $meta: 'searchHighlights' },
               score: { $meta: 'searchScore' }, // Include search relevance score
            },
         },
         {
            $addFields: {
               key: {
                  $arrayElemAt: [
                     {
                        $map: {
                           input: '$highlights',
                           as: 'highlight',
                           in: '$$highlight.path',
                        },
                     },
                     0,
                  ],
               },
            },
         },
         {
            $project: {
               title: 1,
               location: 1,
               key: 1,
               score: 1,
               highlights: 1,
            },
         },
         {
            $sort: { score: -1 }, // Sort by search relevance
         },
         { $limit: 5 },
      ]);

      res.json(properties);
   } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: error.message });
   }
}

export async function getRecommendedStays(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { rating } = req.query;
   const { limit } = req.query;
   const ratingNumber = rating ? Number(rating) : 4;
   const limitNumber = limit ? Number(limit) : 5;
   const user = req.user as ISessionUser;
   try {
      if (isNaN(limitNumber) || limitNumber <= 0) {
         throw new ApiError(
            400,
            "Invalid 'limit' parameter. It should be a positive number.",
         );
      }
      if (isNaN(ratingNumber) || ratingNumber < 0 || ratingNumber > 5) {
         throw new ApiError(
            400,
            "Invalid 'rating' parameter. It should be a number between 0 and 5.",
         );
      }
      const propertiesWithWishlistStatus = await Property.aggregate([
         {
            $match: {
               avgRating: { $gte: ratingNumber },
            },
         },
         // Stage 2: Limit the number of results
         {
            $limit: limitNumber,
         },
         // Stage 3: Select only the required fields
         {
            $project: {
               title: 1,
               thumbnail: 1,
               avgRating: 1,
            },
         },
         // Stage 4: Lookup to check if the property is in the user's wishlist
         {
            $lookup: {
               from: 'wishlists',
               let: { propertyId: '$_id' },
               pipeline: [
                  {
                     $match: {
                        $expr: {
                           $and: [
                              { $eq: ['$userId', user?._id] },
                              { $eq: ['$propertyId', '$$propertyId'] },
                           ],
                        },
                     },
                  },
               ],
               as: 'wishlistInfo',
            },
         },
         // Stage 5: Add a `liked` field based on whether the property is in the wishlist
         {
            $addFields: {
               liked: { $gt: [{ $size: '$wishlistInfo' }, 0] }, // If wishlistInfo has items, `liked` is true
            },
         },
         {
            $project: {
               wishlistInfo: 0,
            },
         },
      ]);
      res.status(200).json(
         new ApiResponse(
            200,
            'Recommended stays fetched successfully',
            propertiesWithWishlistStatus,
         ),
      );
   } catch (err) {
      next(err);
   }
}

export async function getExploreStays(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const properties = await Property.aggregate([
         { $match: { status: 'active' } },
         {
            $unwind: {
               path: '$experienceTags',
               preserveNullAndEmptyArrays: false,
            },
         },
         {
            $group: {
               _id: '$experienceTags',
               properties: {
                  $push: {
                     thumbnail: '$thumbnail',
                     location: {
                        city: '$location.city',
                        state: '$location.state',
                        country: '$location.country',
                     },
                  },
               },
            },
         },
         { $sort: { _id: 1 } },
         {
            $project: {
               _id: 0,
               experienceTag: '$_id',
               places: { $slice: ['$properties', 5] },
            },
         },
      ]);
      res.json(properties);
   } catch (err) {
      next(err);
   }
}

export async function getTrendingStaysThisWeek(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const startOfWeek = moment.utc().startOf('isoWeek').toDate();
      const endOfWeek = moment.utc().endOf('isoWeek').toDate();
      const result = await Reservation.aggregate([
         {
            $match: {
               status: 'complete',
               createdAt: {
                  $gte: startOfWeek,
                  $lte: endOfWeek,
               },
            },
         },
         {
            $group: {
               _id: '$propertyId',
               reservationsCount: { $sum: 1 },
            },
         },
         {
            $sort: {
               reservationsCount: -1,
            },
         },
         {
            $limit: 10,
         },
         {
            $lookup: {
               from: 'properties',
               localField: '_id',
               foreignField: '_id',
               as: 'property',
            },
         },
         {
            $unwind: '$property',
         },
         {
            $project: {
               _id: '$property._id',
               title: '$property.title',
               thumbnail: '$property.thumbnail',
            },
         },
      ]);

      res.status(200).json(
         new ApiResponse(
            200,
            'Top trending properties fetched successfully.',
            result,
         ),
      );
   } catch (err) {
      next(err);
   }
}
