import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { Property } from '../../../models/property/property';
import { Price } from '../../../models/price/price';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import {
   PropertyService,
} from './services/filter.service';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { Reviews } from '../../../models/reviews/reviews';
import { Reservation } from '../../../models/reservation/reservation';
import moment from 'moment';
import * as commonConversationService from "../../common/conversations/conversation.service"
import { getSinglePropertyByFilter } from '../../common/property/property.service';
import { Wishlist } from '../../../models/wishlist/wishList';
import { PipelineStage } from 'mongoose';
import { UserFlagModel } from '../../../models/reports/userFlag';
import { ReportFlowModel } from '../../../models/reports/reports';
import { PropertyUpdateModel } from '../../../models/property/propertyUpdates';
import { createUpdateStatus } from './services/property.service';
import { PROPERTY_STATUS } from '../../../models/property/propertyAttributes/propertyAttributes';
import { User } from '../../../models/user/user';
import { generatePipeForCurrencyConversion } from '../../../utils/aggregation-pipelines/agregation.utils';
import { createRecipient, dispatchNotification } from '../../common/notifications/services/dispatch.service';
import { createPriceService } from '../../../models/price/services/price.service';
import { PropertyFilter } from './services/filter.service';
import { MongoObjectId } from '../../../types/mongo/mongo';

function normalizeToArray<T = string>(value: T | T[] | undefined): T[] {
   if (!value) return [];
   return Array.isArray(value) ? value : [value];
}

export async function getFilterProperties(req: Request, res: Response) {
   const { currency, pagination } = res.locals
   const propertyService = new PropertyService(currency);

   const filters: PropertyFilter = {
      ...req.query,
      amenities: normalizeToArray(req.query.amenities as string | string[]),
      propertyType: normalizeToArray(req.query.propertyType as string | string[])
   };

   const user = req.user as ISessionUser;

   const result = await propertyService.getFilteredProperties(
      filters,
      pagination,
      user?._id
   );

   return res.json(result);
}


export async function getPropertiesReviewsById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { pagination } = res.locals;
   try {
      const propertyId = validateObjectId(req.params.propertyId);
      const [totalReviewCount, reviews] = await Promise.all([
         Reviews.countDocuments({ propertyId }),
         Reviews.find({ propertyId })
            .populate({ path: "userId", select: "firstName lastName  profilePicture" })
            .sort({ reviewedAt: -1 })
            .skip(pagination.startIndex)
            .limit(pagination.limit)
            .lean(),
      ]);
      const result = formatPaginationResponse(
         reviews,
         totalReviewCount,
         pagination,
      );
      return res.json(result);
   } catch (err) {
      return next(err);
   }
}

export async function getPropertiesPricingById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { currency } = res.locals

      const query: Partial<{
         checkIn: Date;
         checkOut: Date;
         child: string;
         adult: string;
         currency: string
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
         {
            _id: propertyId,
            status: { $in: [PROPERTY_STATUS.ACTIVE, PROPERTY_STATUS.SUSPENDED] }

         },
         { _id: 1, price: 1, availabilityWindow: 1 },
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
                  'Pricing not available for the provided date range.',
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

      const priceService = createPriceService(price)

      const result = await priceService.calculateTotalPrice({
         checkIn,
         checkOut,
         childCount: child,
         adultCount: adult,
         guestRequestedCurrency: currency,
         promoCode: null,
         userId: null
      })
      // console.log({ result });

      // const total = await price.calculateTotalPrice(
      //    checkIn,
      //    checkOut,
      //    child,
      //    adult,
      //    null,
      //    null,
      //    currency
      // );

      return res.json(result);
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
               index: 'default',
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
               status: PROPERTY_STATUS.ACTIVE,
               visibility: 'published',
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
               visibility: "published",
               status: PROPERTY_STATUS.ACTIVE,
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

   const properties = await Property.aggregate([
      { $match: { visibility: "published", status: PROPERTY_STATUS.ACTIVE } },
      { $unwind: '$experienceTags' },
      {
         $group: {
            _id: { experienceTag: '$experienceTags', state: '$location.state', country: "$location.country" },
            thumbnail: { $first: '$thumbnail' }
         }
      },
      {
         $group: {
            _id: '$_id.experienceTag',
            places: {
               $push: {
                  location: {
                     state: '$_id.state',
                     country: "$_id.country"
                  },
                  thumbnail: '$thumbnail'
               }
            }
         }
      },
      { $sort: { _id: 1 } },
      {
         $project: {
            _id: 0,
            experienceTag: '$_id',
            places: { $slice: ['$places', 5] }
         }
      }
   ]);

   return res.json(properties);

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
               pipeline: [
                  {
                     $match: {
                        status: PROPERTY_STATUS.ACTIVE,
                     }
                  }
               ],
               as: 'property',
            },
         },
         {
            $unwind: { path: '$property', preserveNullAndEmptyArrays: false },
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

export async function getFullPropertyByIdForHostAndUser(
   req: Request,
   res: Response,
) {

   const currency = res.locals.currency;
   const user = req.user;
   const { requestOrigin: currentPanel } = res.locals.sessionOptions;

   const propertyId = validateObjectId(req.params.id);

   const filter: {
      _id: MongoObjectId;
      status?: any;
      visibility?: 'published' | 'draft';
      hostId?: MongoObjectId;
   } = { _id: propertyId };

   if (currentPanel === 'guest') {
      filter.visibility = 'published';
   } else if (currentPanel === 'host' && user?._id) {
      filter.hostId = user._id;
   }

   const propertyPromise = getSinglePropertyByFilter(filter, user?._id, currency);

   const wishlistPromise =
      currentPanel === 'guest' && user?._id
         ? Wishlist.findOne({ userId: user._id, propertyId })
            .select('_id')
            .lean()
         : null;

   const roomPromise =
      currentPanel === 'guest' && user?._id
         ? commonConversationService.getRoomDetailsForProperty(
            { propertyId, conversationType: 'guest-host' },
            user._id,
            currentPanel
         )
         : null;

   const lastUpdatePromise =
      currentPanel === 'host' && user?._id
         ? PropertyUpdateModel.findOne({
            propertyId,
            userId: user._id,
            status: { $ne: 'verified' },
         })
            .sort({ createdAt: -1 })
            .lean()
         : null;

   const [result, wishlist, roomDetails, lastUpdate] = await Promise.all([
      propertyPromise,
      wishlistPromise ?? Promise.resolve(null),
      roomPromise ?? Promise.resolve<commonConversationService.RoomSessionStatus | null>(null),
      lastUpdatePromise ?? Promise.resolve(null),
   ]);

   if (!result) {
      throw new ApiError(404, 'No property found');
   }

   const propertyWithMeta: any = { ...result };

   if (currentPanel === 'guest') {
      propertyWithMeta.liked = user?._id
         ? Boolean(wishlist)
         : null;
      propertyWithMeta.hasPendingSensitiveUpdates = undefined
      if (user?._id) {
         const hasRoom = roomDetails.hasRoom
         propertyWithMeta.hasRoom = hasRoom
         propertyWithMeta.roomDetails = hasRoom ? roomDetails : null;
      }
   }

   if (currentPanel === 'host') {
      propertyWithMeta.updateStatus = createUpdateStatus(lastUpdate);
   }

   return res.json(new ApiResponse(200, 'Property retrieved successfully', propertyWithMeta));

};



export const submitUserReport = async (req: Request, res: Response, next: NextFunction) => {

   const user = req.user

   try {

      const propertyId = req.params.id

      const {
         name,
         flaggableType,
         flaggableId,
         metaData,
         steps,
         flaggingUserId,
      } = req.body;

      if (!flaggableId || !flaggableType || !name || !flaggingUserId) {
         return res.status(400).json({ message: "Missing required fields" });
      }

      if (!validateObjectId(propertyId) || !validateObjectId(flaggingUserId)) {
         return res.status(400).json({ message: "Invalid Object ID format" });
      }


      const existReport = await UserFlagModel.findOne({
         flaggingUserId,
         propertyId: validateObjectId(propertyId)
      });

      if (existReport) {
         throw new ApiError(400, "You have already submitted a report for this property")
      }

      const report = await UserFlagModel.create({
         name,
         flaggableType,
         flaggableId,
         metaData,
         steps,
         flaggingUserId,
         propertyId
      });

      const [admin, property, sessionUser] = await Promise.all([
         User.findOne({ role: 'admin' }).select('_id'),
         Property.findById(propertyId).select('title'),
         User.findById(user._id).select('firstName lastName')

      ])

      const payload = createRecipient('inApp', {
         redirectKey: 'property-report-review',
         title: 'New Property Report Submitted',
         message: 'A user has reported a property. Review the details and take necessary action.',
         metadata: {
            flaggedProperty: {
               propertyId: String(propertyId),
               propertyTitle: property.title,
            },
            reportedBy: {
               userId: flaggingUserId,
               name: `${sessionUser.firstName} ${sessionUser.lastName}`
            }
         },
         userId: String(admin._id),
         visibleToRoles: ['admin'],
      });

      dispatchNotification({ recipients: [payload] })

      return res.json(new ApiResponse(201, "Report submitted", report))

   } catch (error) {
      console.log(error);
      next(error);
   }
};


export const getReportFlow = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const flow = await ReportFlowModel.find();
      return res.status(200).json({ message: "Report fetched successfully", data: flow });
   } catch (error) {
      console.log(error);
      next(error);
   }
};

export const getUserReportList = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const userReportList = await UserFlagModel.find();
      return res.status(200).json({ message: "Report fetched successfully", data: userReportList });
   } catch (error) {
      console.log(error);
      next(error);
   }
};



interface PropertyEstimateFilter {
   status?: string;
   typeOfPlace?: string;
   propertyType?: string[];
   bedrooms?: number;
   bathrooms?: number;
   latitude?: number;
   longitude?: number;
   maxDistance?: number;
}

export async function calculateEstimateEarnings(req: Request, res: Response, next: NextFunction) {
   const { currency } = res.locals

   const { propertyType = 'entire-home', bedrooms = 3, longitude = 77.5946, latitude = 12.9716, maxDistance = 5000 } = req.query as PropertyEstimateFilter

   try {

      // const currencyConverterPipe = await generatePipeForCurrencyConversion(currency, "$price.basePrice.currency", "$price.basePrice.amount")

      const currencyConversionPipe = await generatePipeForCurrencyConversion(
         {
            baseAmountAttribute: '$price.basePrice.amount',
            baseCurrencyAttribute: "$price.basePrice.currency",
            includeExchangeRate: true,
            requestCurrency: currency?.toLowerCase(),
            outputField: "finalConvertedCurrency"
         }
      )

      const pipeline: PipelineStage[] = [
         {
            $geoNear: {
               near: { type: "Point", coordinates: [Number(longitude), Number(latitude)] },
               distanceField: "distance",
               maxDistance: Number(maxDistance),
               spherical: true,
            },
         },
         {
            $match: {
               propertyPlaceType: propertyType,
               "details.bedRooms": Number(bedrooms),
               status: PROPERTY_STATUS.ACTIVE,
               visibility: "published",
            },
         },
         {
            $lookup: {
               from: "prices",
               localField: "price",
               foreignField: "_id",
               pipeline: [
                  {
                     $project: {
                        basePrice: 1,
                     },
                  },
               ],
               as: "price",
            },
         },
         {
            $unwind: {
               path: "$price",
               preserveNullAndEmptyArrays: false,
            },
         },
         ...currencyConversionPipe,
         {
            $facet: {
               nearbyPricingStats: [
                  {
                     $addFields: {
                        price: {
                           amount: { $round: ["$finalConvertedCurrency", 0] },
                           currency: currency.toUpperCase(),
                        },
                     },
                  },
                  {
                     $group: {
                        _id: null,
                        averageNightlyRate: { $avg: "$price.amount" },
                     },
                  },

               ],
               nearbyProperties: [
                  {
                     $addFields: {
                        "price.basePrice": {
                           amount: { $round: ["$finalConvertedCurrency", 0] },
                           currency: currency.toUpperCase(),
                        },
                     },
                  },
                  {
                     $project: {
                        title: 1,
                        thumbnail: 1,
                        details: 1,
                        location: 1,
                        distance: 1,
                        price: 1,
                        capacity: 1
                     },
                  },
               ],
            },
         },
      ]
      const [result] = await Property.aggregate(pipeline);
      const nearbyPricingStats = result?.nearbyPricingStats?.[0] || { averageNightlyRate: 0 };
      const nearbyProperties = result?.nearbyProperties || [];

      const nightsCount = 30;
      const averageNightlyRate = nearbyPricingStats?.averageNightlyRate ?? 0;

      let nightlyEarningsProjection = null
      if (nearbyProperties.length > 0) {

         nightlyEarningsProjection = Array.from({ length: nightsCount }, (_, index) => ({
            night: index + 1,
            currency,
            totalEarnings: averageNightlyRate * (index + 1),
         }));
      }

      const responsePayload = {
         hasAvailableListings: nearbyProperties.length > 0,
         nightlyEarningsProjection,
         nearbyProperties,
         requestedCriteria: {
            propertyType,
            bedrooms,
            longitude,
            latitude,
            maxDistance,
            currency
         },
      };
      return res.json(new ApiResponse(200, 'Near by Properties fetched successfully', responsePayload))

   }

   catch (err) {
      console.log({ err });

      return next(err)
   }


}