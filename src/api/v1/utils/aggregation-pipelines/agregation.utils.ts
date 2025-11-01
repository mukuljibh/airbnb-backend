import mongoose, { PipelineStage } from 'mongoose';
import { Property } from '../../models/property/property';
import { IReviews } from '../../models/reviews/types/reviews.type';
import { Reviews } from '../../models/reviews/reviews';
import { ApiError } from '../error-handlers/ApiError';
import { User } from '../../models/user/user';
import { IUser } from '../../models/user/types/user.model.types';
import { getApiCurrency } from '../../models/price/utils/price.utils';
import { Reservation } from '../../models/reservation/reservation';
import { IPricing } from '../../models/price/types/price.model.type';
import { eachDayOfInterval, format } from 'date-fns';
import moment from 'moment';
import { validateObjectId } from '../mongo-helper/mongo.utils';

export async function getHostAllPropertiesReviewsStatistics(
   hostId: mongoose.Types.ObjectId,
   pagesAttr?: Partial<{
      startIndex: number;
      limit: number;
   }>,
): Promise<{
   totalReviewCount: number;
   overallAvgRating: number;
   allReviews: IReviews;
}> {
   const filter = [];
   if (pagesAttr?.startIndex) {
      filter.push({ $skip: pagesAttr.startIndex });
   }
   if (pagesAttr?.limit) {
      filter.push({ $limit: pagesAttr.limit });
   }

   const allReviewsDetails = [
      {
         $match: {
            hostId: hostId,
            visibility: 'published',
         },
      },
      {
         $lookup: {
            from: 'reviews',
            localField: '_id',
            foreignField: 'propertyId',
            as: 'reviews',
         },
      },
      {
         $unwind: {
            path: '$reviews',
            preserveNullAndEmptyArrays: false,
         },
      },
      {
         $lookup: {
            from: 'users',
            localField: 'reviews.userId',
            foreignField: '_id',
            as: 'userDetails',
         },
      },
      {
         $unwind: {
            path: '$userDetails',
            preserveNullAndEmptyArrays: false,
         },
      },
      {
         $facet: {
            stats: [
               {
                  $group: {
                     _id: null,
                     totalReviewCount: { $sum: 1 },
                     overallAvgRating: { $avg: '$reviews.rating' },
                  },
               },
            ],
            limitedReviews: [
               ...filter,
               {
                  $group: {
                     _id: null,
                     allReviews: {
                        $push: {
                           createdAt: '$reviews.createdAt',
                           property_id: '$reviews.propertyId',
                           user_id: '$reviews.userId',
                           user: {
                              firstName: '$userDetails.firstName',
                              lastName: '$userDetails.lastName',
                              profileImage: '$userDetails.profilePicture',
                           },
                           content: '$reviews.content',
                           rating: '$reviews.rating',
                        },
                     },
                  },
               },
               {
                  $project: {
                     _id: 0,
                     allReviews: 1,
                  },
               },
            ],
         },
      },
      {
         $project: {
            totalReviewCount: {
               $arrayElemAt: ['$stats.totalReviewCount', 0],
            },
            overallAvgRating: {
               $arrayElemAt: ['$stats.overallAvgRating', 0],
            },
            allReviews: { $arrayElemAt: ['$limitedReviews.allReviews', 0] },
         },
      },
   ];

   return (await Property.aggregate(allReviewsDetails))[0];
}

export async function getAvgReviewsForSinglePropertyPipeline(
   id: mongoose.Types.ObjectId | null,
   limit?: number | null,
) {
   // Start with an empty match stage
   const matchStage = id ? { propertyId: id } : {};
   const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
         $facet: {
            reviews: [
               // { $sort: { rating: -1 } },
               {
                  $sort: {
                     reviewedAt: -1
                  }
               },
               ...(limit ? [{ $limit: limit }] : []),
               {
                  $lookup: {
                     from: 'users',
                     localField: 'userId',
                     foreignField: '_id',
                     as: 'user',
                  },
               },
               { $unwind: '$user' },
               {
                  $project: {
                     _id: 1,
                     content: 1,
                     rating: 1,
                     createdAt: 1,
                     reviewedAt: 1,
                     'user._id': 1,
                     'user.firstName': 1,
                     'user.lastName': 1,
                     'user.profileImage': '$user.profilePicture',
                  },
               },

            ],
            // averageRating: [
            //    {
            //       $group: {
            //          _id: null,
            //          avgRating: { $avg: '$rating' },
            //       },
            //    },
            // ],
            totalReviews: [{ $count: 'count' }],
         },
      },
      {
         $project: {
            reviews: 1,
            // averageRating: { $arrayElemAt: ['$averageRating.avgRating', 0] },
            totalReviews: { $arrayElemAt: ['$totalReviews.count', 0] },
         },
      }
   ];

   const [result] = await Reviews.aggregate<{
      reviews: IReviews[];
      // averageRating: number;
      totalReviews: number;
   }>(pipeline)

   return result
}

export async function getSinglePropertyAvgReviews(
   propertyId: mongoose.Types.ObjectId,
) {
   const matchStage = propertyId ? { _id: validateObjectId(propertyId) } : {};

   const pipeline: PipelineStage[] = []
   pipeline.push({ $match: matchStage })
   pipeline.push({
      $lookup: {
         let: {
            propertyId: "$_id"
         },
         from: 'reviews',

         pipeline: [
            {
               $match: {
                  $expr: {
                     $and: [
                        { $eq: ['$propertyId', '$$propertyId'] }
                     ]
                  }
               }
            }
         ],

         as: 'result',
      },
   },
      {
         $unwind: {
            path: '$result',
            preserveNullAndEmptyArrays: false,
         },
      })

   pipeline.push({
      $group: {
         _id: '$_id',
         totalReviews: { $sum: 1 },
         averageRating: { $avg: '$result.rating' },
      }
   },
      {
         $project: {
            _id: 1,
            totalReviews: 1,
            averageRating: { $ifNull: [{ $round: ['$averageRating', 1] }, 0] }
         }
      })


   const property = await Property.aggregate<{
      totalReviews: number;
      averageRating: number;
   }>(pipeline);

   return property;
}

export type UserMinimalDetailType = Pick<
   IUser,
   | '_id'
   | 'firstName'
   | 'lastName'
   | 'role'
   | 'phone'
   | 'email'
   | 'hasBasicDetails'
   | 'hasPhoneVerified'
   | 'hasEmailVerified'
>;

export async function getUserFromDb(userId: mongoose.Types.ObjectId) {
   if (!userId) {
      throw new ApiError(
         500,
         'something went wrong  session is missing from passport session object',
      );
   }
   const user = await User.findById(userId).select(
      'firstName lastName hasBasicDetails hasPhoneVerified hasEmailVerified role email phone',
   );
   if (!user) {
      throw new ApiError(
         500,
         'something went wrong cant able to get user from db',
      );
   }
   return user as UserMinimalDetailType;
}

interface IConversionPipe {
   baseCurrencyAttribute: string,   // e.g. "$price.basePrice.currency"
   requestCurrency: string,         // e.g. "usd"
   baseAmountAttribute: string,     // e.g. "$avgNightlyRate"
   outputField: string,             // e.g. "avgNightlyRateInRequestCurrency"
   includeExchangeRate: boolean     // whether to push exchange rate alongside value
}

export async function generatePipeForCurrencyConversion(options: IConversionPipe) {

   const { baseAmountAttribute, baseCurrencyAttribute, includeExchangeRate, outputField, requestCurrency } = options

   const rates = await getApiCurrency("usd");

   const usdRates = rates["usd"];

   const pipeline: PipelineStage[] = []

   // Injecting rates object (converted in app) as a constant map in here.
   if (includeExchangeRate) {
      pipeline.push({
         $addFields: {
            exchangeRates: usdRates
         }
      })
   }

   pipeline.push({
      //host currency --- > USD --- > guest curency
      $addFields: {

         //host price curency unit rate host currency -- > USD
         billingCurrencyToUsd: {
            $divide: [1, { $getField: { field: { $toLower: baseCurrencyAttribute }, input: "$exchangeRates" } }]

         },
         usdToRequestedCurrency: {
            $getField: { field: requestCurrency, input: "$exchangeRates" }
         },
      }
   },)

   pipeline.push({
      $addFields: {
         [outputField]: { $multiply: [{ $multiply: [baseAmountAttribute, "$billingCurrencyToUsd"] }, "$usdToRequestedCurrency"] }
      }
   })

   pipeline.push({
      $project: {

         billingCurrencyToUsd: 0,
         usdToRequestedCurrency: 0,
      }


   })
   return pipeline

}




export async function getAllDayReservationStatus(
   { startDate, endDate }: { startDate: Date; endDate: Date },
   filter = {},
) {
   const propertyId = new mongoose.Types.ObjectId('67fa19f3e1e053fc5e04ad79')

   const matchFilter = {
      status: "complete",
      checkInDate: { $gte: startDate, $lte: endDate },
      propertyId,
      ...filter,

   }

   const pipeline: PipelineStage[] = [
      {
         $match: matchFilter
      },

      {
         $addFields: {
            dayDiff: {
               $add: [
                  {
                     $trunc: {
                        $divide: [
                           { $subtract: ["$checkOutDate", "$checkInDate"] },
                           1000 * 60 * 60 * 24
                        ]
                     }
                  },
                  1
               ]
            }
         }
      },
      {
         $addFields: {
            daysArray: { $range: [0, "$dayDiff"] }
         }
      },
      {
         $unwind: "$daysArray"
      },
      {
         $addFields: {
            day: {
               $dateAdd: {
                  startDate: "$checkInDate",
                  unit: "day",
                  amount: "$daysArray"
               }
            },
            isSelfBooked: "$isSelfBooked",

            reservationData: {
               checkInDate: "$checkInDate",
               checkOutDate: "$checkOutDate",
               status: "$status",
               totalPrice: "$totalPrice"

            },
            priceData: {

               $cond: {
                  if: { $ifNull: ["$priceData.price", false] },
                  then: "$priceData",
                  else: {}
               }

            },
            available: false,
            strikethroughDate: true
         },

      },

      {
         $project: {
            day: 1,
            isSelfBooked: 1,
            reservationData: 1,
            available: 1,
            priceData: 1
         }
      },
      {
         $sort: {
            day: 1
         }
      }

   ]




   const resultA = Reservation.aggregate(pipeline)

   const propertyA = Property.findById(propertyId).populate<{ price: IPricing }>({ path: "price", select: "basePrice" })

   const [result, property] = await Promise.all([resultA, propertyA])


   const price = property.price


   const dayWiseData = eachDayOfInterval({ start: startDate, end: endDate }).map(
      (d) => format(d, 'dd-MM-yyyy'),
   );

   const padded = dayWiseData.map((unit) => {

      const existing = result.find((r) => {
         const day = format(r.day, 'dd-MM-yyyy')

         return day === unit
      });

      if (existing) {
         if (!existing?.priceData?.price) {
            existing.priceData.price = price.basePrice.amount
            existing.priceData.currency = price.basePrice.currency
         }
      }
      return (
         existing || {
            day: unit,
            isSelfBooked: false,
            available: true,
            reservationData: null,
            priceData: {
               price: price.basePrice.amount,
               currency: price.basePrice.currency
            }
         }
      );
   });

   return padded;
}


export async function generateDraftOrPropertyPayload(propertyId: mongoose.Types.ObjectId, hostId: mongoose.Types.ObjectId) {

   const todayDate = moment.utc(new Date()).startOf('date').toDate();


   const [draftOrProperty] = await Property.aggregate([
      {
         $match: {
            _id: propertyId,
            hostId: hostId
         }
      },

      {
         $lookup: {
            from: 'prices',
            localField: 'price',
            foreignField: '_id',
            as: 'price'
         }
      },

      {
         $unwind: {
            path: "$price",
            preserveNullAndEmptyArrays: true
         }
      },
      {
         $lookup: {
            from: 'propertyrules',
            localField: 'propertyRules',
            foreignField: '_id',
            as: 'propertyRules'
         }
      },

      {
         $unwind: {
            path: "$propertyRules",
            preserveNullAndEmptyArrays: true
         }
      },
      {
         $lookup: {
            from: 'reservations',
            let: { propertyId: '$_id' },
            pipeline: [
               {
                  $match: {
                     $expr: {
                        $and: [
                           { $eq: ['$propertyId', '$$propertyId'] },
                           { $gte: ['$checkOutDate', todayDate] },
                           { $ne: ['$status', 'cancelled'] }
                        ]
                     }
                  }
               },
               { $limit: 1 }
            ],
            as: 'reservations'
         }
      },
      {
         $addFields: {
            hasActiveBooking: { $gt: [{ $size: '$reservations' }, 0] }
         }
      },
      {
         $project: {
            reservations: 0
         }
      },

      {
         $addFields: {
            exists: true,
            completedStages: "$draftStage",
            visibility: "$visibility",
            stages: [
               {
                  data: {
                     stage: 1,
                     propertyTitle: "$title",
                     propertyType: "$propertyType",
                     propertyCategoryId: "$category",
                     propertyDescription: "$details.description",
                     experienceTags: "$experienceTags",
                     propertyCountry: "$location.country",
                     propertyState: "$location.state",
                     propertyCity: "$location.city",
                     propertyLandmark: "$location.landmark",
                     propertyAddress: "$location.address",
                     propertyZipcode: "$location.zipCode",
                     propertyCoordinates: "$location.coordinates",
                     propertyGallery: "$gallery",
                     propertyPlaceType: "$propertyPlaceType",
                     availabilityWindow: "$availabilityWindow"
                  },
               },

               {
                  data: {
                     stage: 2,
                     beds: "$details.beds",
                     bathRooms: "$details.bathRooms",
                     bedRooms: "$details.bedRooms",
                     maxGuest: "$capacity.maxGuest",
                     amenities: "$amenities"
                  }
               },

               {
                  data: {
                     stage: 3,
                     pricePerNight: "$price.basePrice.amount",
                     currency: "$price.basePrice.currency",
                     cleaningFees: "$price.additionalFees.cleaning",
                     serviceFees: "$price.additionalFees.service",
                     weeklyRateDiscount: {
                        $ifNull: [
                           { $getField: { field: "discount", input: { $arrayElemAt: ["$price.lengthDiscounts", 0] } } },
                           null
                        ]
                     },
                     monthlyRateDiscount: {
                        $ifNull: [
                           { $getField: { field: "discount", input: { $arrayElemAt: ["$price.lengthDiscounts", 1] } } },
                           null
                        ]
                     }
                  }
               },

               {
                  data: {
                     stage: 4,
                     housingRules: "$propertyRules.housingRules",
                     safetyAndProperty: "$propertyRules.safetyAndProperty",
                     cancellationPolicy: "$propertyRules.cancellationPolicy",
                     checkInTime: "$propertyRules.checkInTime",
                     checkOutTime: "$propertyRules.checkOutTime",

                  }
               },

               {
                  data: {
                     stage: 5,
                     isPetAllowed: "$propertyRules.isPetAllowed",
                     isHaveSelfCheckin: "$propertyRules.isHaveSelfCheckin",
                     isHaveInstantBooking: "$propertyRules.isHaveInstantBooking",
                     generalNote: "$propertyRules.notes.generalNote",
                     nearByAttractionNote: "$propertyRules.notes.nearByAttractionNote",

                  }
               },
               {
                  data: {
                     stage: 6,
                     status: "$verification.status",
                     reason: "$verification.reason",
                     documents: "$verification.documents",
                  }
               }

            ],


         }
      },
      {
         $project: {
            exists: 1,
            completedStages: 1,
            visibility: 1,
            stages: 1,
            hasActiveBooking: 1
         }
      }
   ])

   return draftOrProperty
}