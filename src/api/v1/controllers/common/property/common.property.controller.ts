import { Property } from '../../../models/property/property';
import { Wishlist } from '../../../models/property/wishList';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import {
   getAvgReviewsForSinglePropertyPipeline,
   getUserFromDb,
} from '../../../utils/aggregation-pipelines/agregation.utils';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { getBlockDates } from '../../general/properties/utils/general.property.utils';
import {
   createPropertyDraftQuery,
   sortFieldType,
} from '../../general/user/utils/general.user.utils';
import { Request, Response, NextFunction } from 'express';

export async function getPropertiesList(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sessionUser = req.user as ISessionUser;
   try {
      const user = await getUserFromDb(sessionUser._id);
      const isUserAdmin = user.role.includes('admin');

      const { status, verificationStatus, searchTerm, sortField, sortOrder } =
         req.query as {
            status: string;
            verificationStatus: 'verified' | 'rejected' | 'required_action';
            searchTerm: string;
            sortField: sortFieldType;
            sortOrder: string;
         };
      const pagesAttr = res.locals.pagination;
      let result = {};
      switch (status) {
         case 'drafts': {
            const query = await createPropertyDraftQuery(
               { searchTerm, sortField, sortOrder },
               user,
               pagesAttr,
               'draft',
               'inactive',
               verificationStatus,
            );
            const filterAllProperties = query.property;
            const countOfAllFilterProperties = query.totalCount;

            result = formatPaginationResponse(
               filterAllProperties,
               countOfAllFilterProperties,
               pagesAttr,
            );
            break;
         }
         case 'active-published': {
            const query = await createPropertyDraftQuery(
               { searchTerm, sortField, sortOrder },
               user,
               pagesAttr,
               'published',
               'active',
            );
            const filterActiveProperties = query.property;
            const countOfFilterActiveProperties = query.totalCount;
            result = formatPaginationResponse(
               filterActiveProperties,
               countOfFilterActiveProperties,
               pagesAttr,
            );
            break;
         }
         case 'inactive-published': {
            const query = await createPropertyDraftQuery(
               { searchTerm, sortField, sortOrder },
               user,
               pagesAttr,
               'published',
               'inactive',
            );
            const filterInActiveProperties = query.property;
            const countOfInActiveProperties = query.totalCount;

            result = formatPaginationResponse(
               filterInActiveProperties,
               countOfInActiveProperties,
               pagesAttr,
            );
            break;
         }
         case 'all-published': {
            const query = await createPropertyDraftQuery(
               { searchTerm, sortField, sortOrder },
               user,
               pagesAttr,
               'published',
            );
            const filterAllProperties = query.property;
            const countOfAllFilterProperties = query.totalCount;

            result = formatPaginationResponse(
               filterAllProperties,
               countOfAllFilterProperties,
               pagesAttr,
            );
            break;
         }

         case 'all': {
            //change in this future for now suitable for moderate dataset
            if (isUserAdmin) {
               throw new ApiError(
                  501,
                  'status All for admin is not yet implemented',
               );
            }
            const query = await createPropertyDraftQuery(
               { searchTerm, sortField, sortOrder },
               user,
               pagesAttr,
            );

            const filterProperties = query.property;
            const countOfFilterProperties = query.totalCount;

            result = formatPaginationResponse(
               filterProperties,
               countOfFilterProperties,
               pagesAttr,
            );

            break;
         }
         default:
            throw new ApiError(
               400,
               'please provide a valid status either drafts | active-published | inactive-published | all-published | all ',
            );
      }

      res.status(200).json(result);
   } catch (err) {
      next(err);
   }
}

//get property by id of the property
export const getFullPropertyById = async (req, res, next) => {
   const user = req.user as ISessionUser;
   try {
      const id = validateObjectId(req.params.id);
      const hostProperty = await Property.findById(id).select(
         'hostId availablityWindow',
      );
      if (!hostProperty) {
         throw new ApiError(404, 'Property not found');
      }
      const viewingOwnProperty = hostProperty.hostId.equals(user?._id);

      // Fetch property, reviews, and wishlist in parallel
      const [property, topReviewsWithAvgRatings, blockDates, wishlistItem] =
         await Promise.all([
            Property.findById(id)
               .select('-status -category -createdAt -updatedAt -thumbnail')
               .populate({
                  path: 'amenities',
                  select: 'title icon',
               })
               .populate('propertyRules')
               .populate({
                  path: 'price',
                  select: 'basePrice lengthDiscounts',
               })
               .populate({
                  path: 'hostId',
                  select:
                     'firstName lastName profilePicture createdAt role languages email phone.number hasPhoneVerified hasEmailVerified',
               })
               .lean(),
            getAvgReviewsForSinglePropertyPipeline(id, 5),
            getBlockDates(id),

            Wishlist.findOne({
               userId: user?._id,
               propertyId: id,
            }).select('_id'),
         ]);
      const propertyWithLikedStatus = {
         ...property,
         viewingOwnProperty,
         topReviewsWithAvgRatings,
         blockDates,
         price: property.price?.['basePrice'],
         discounts: property.price?.['lengthDiscounts'],
         liked: !!wishlistItem,
      };

      return res
         .status(200)
         .json(
            new ApiResponse(
               200,
               'Property retrieved successfully',
               propertyWithLikedStatus,
            ),
         );
   } catch (err) {
      next(err);
   }
};
