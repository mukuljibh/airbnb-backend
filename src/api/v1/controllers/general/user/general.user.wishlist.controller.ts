import { Wishlist } from '../../../models/property/wishList';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { Property } from '../../../models/property/property';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { getBlockDates } from '../properties/utils/general.property.utils';

export async function showAllWishListProperties(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   const pagesAttr = res.locals.pagination;
   try {
      const wishListProperties = await Property.aggregate([
         {
            $lookup: {
               from: 'amenities',
               localField: 'amenities',
               foreignField: '_id',
               as: 'amenities',
            },
         },
         {
            $lookup: {
               from: 'prices',
               localField: 'price',
               foreignField: '_id',
               as: 'price',
            },
         },
         {
            $unwind: {
               path: '$price',
               preserveNullAndEmptyArrays: false,
            },
         },
         {
            $lookup: {
               from: 'wishlists',
               localField: '_id',
               foreignField: 'propertyId',
               as: 'wishList',
            },
         },

         {
            $unwind: {
               path: '$wishList',
               preserveNullAndEmptyArrays: false,
            },
         },
         {
            $match: {
               'wishList.userId': user._id,
            },
         },
         {
            $project: {
               title: 1,
               description: 1,
               avgRating: 1,
               location: 1,
               capacity: 1,
               gallery: 1,
               amenities: 1,
               details: 1,
               price: '$price.basePrice',
            },
         },
         { $skip: pagesAttr.startIndex },
         { $limit: pagesAttr.limit },
      ]);
      const allPropertyWishlistWithAvailability = await Promise.all(
         wishListProperties.map(async (property) => ({
            ...property,
            blockDates: await getBlockDates(property._id),
         })),
      );

      const totalCount = await Wishlist.countDocuments({ userId: user._id });
      const result = formatPaginationResponse(
         allPropertyWishlistWithAvailability,
         totalCount,
         pagesAttr,
      );
      res.status(200).json(result);
   } catch (err) {
      next(err);
   }
}

export async function addPropertyToWishList(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;

   try {
      const propertyId = validateObjectId(req.params.propertyId);

      // Check if property exists and is not already wishlisted in parallel
      const [property, wishlist] = await Promise.all([
         Property.findById(propertyId).lean(),
         Wishlist.findOne({ userId: user._id, propertyId }).lean(),
      ]);

      if (!property) {
         throw new ApiError(
            404,
            'Property not found. Please check your property ID.',
         );
      }

      if (wishlist) {
         throw new ApiError(400, 'Property is already in your wishlist.');
      }

      await Wishlist.create({ userId: user._id, propertyId });

      res.status(201).json(
         new ApiResponse(201, 'Property added to your wishlist.'),
      );
   } catch (err) {
      console.error('Add to Wishlist Error:', err);
      next(err);
   }
}

export async function removePropertyFromWishList(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const propertyId = validateObjectId(req.params.propertyId);

      const [property, wishlist] = await Promise.all([
         Property.findById(propertyId),
         Wishlist.findOne({ userId: user?._id, propertyId: propertyId }),
      ]);
      if (!property) {
         throw new ApiError(
            404,
            'Property not found. Please verify the property ID and try again.',
         );
      }
      if (!wishlist) {
         throw new ApiError(400, 'This property is not in your wishlist.');
      }

      await wishlist.deleteOne();
      res.status(200).json(
         new ApiResponse(
            200,
            'Property successfully removed from your wishlist.',
         ),
      );
   } catch (err) {
      next(err);
   }
}
