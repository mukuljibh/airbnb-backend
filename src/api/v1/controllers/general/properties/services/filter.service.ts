import mongoose, { PipelineStage } from 'mongoose';
import { ApiError } from '../../../../utils/error-handlers/ApiError';
import { CategoryModel } from '../../../../models/category/category';
import { Property } from '../../../../models/property/property';
import { dateRegex } from '../../../../constant/regex.constant';
import { formatPaginationResponse } from '../../../../utils/pagination/pagination.utils';
import moment from 'moment';
import { generatePipeForCurrencyConversion } from '../../../../utils/aggregation-pipelines/agregation.utils';
import { PROPERTY_STATUS } from '../../../../models/property/propertyAttributes/propertyAttributes';


export interface PropertyFilter {
   status?: string;
   categoryName?: string;
   experienceTags?: string;
   typeOfPlace?: string;
   propertyType: string[];
   checkin?: string;
   checkout?: string;
   guest?: number;
   destination?: string;
   amenities: string[];
   bed?: number;
   bedrooms?: number;
   minPrice?: number;
   maxPrice?: number;
   bathrooms?: number;
   nights?: number;
}

interface PaginationAttributes {
   startIndex: number;
   endIndex: number;
   page: number;
   limit: number;
}

export class PropertyService {
   private isDemandedForAvailabilty = false;
   private currency;

   constructor(currency: string) {
      this.currency = currency
   }

   private async validateDates(checkin: string, checkout: string) {
      const checkinDate = new Date(checkin);
      const checkoutDate = new Date(checkout);
      if (!dateRegex.test(checkin) || !dateRegex.test(checkout)) {
         throw new ApiError(400, 'Invalid date format. Use YYYY-MM-DD.');
      }
      if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
         throw new ApiError(400, 'Invalid check-in or check-out date format.');
      }

      if (checkinDate > checkoutDate) {
         throw new ApiError(
            400,
            'Check-in date must not be greater than check-out date.',
         );
      }
   }

   private buildWishListPipeline(
      userId: mongoose.Types.ObjectId,
   ): PipelineStage[] {

      if (!userId) {
         return [
            {
               $addFields: {
                  liked: null
               }
            }
         ]
      }
      return [
         {
            $lookup: {
               from: "wishlists",
               let: { propertyId: "$_id" },
               pipeline: [
                  {
                     $match: {
                        $expr: {
                           $and: [
                              { $eq: ["$userId", userId] },
                              { $eq: ["$propertyId", "$$propertyId"] },
                           ],
                        },
                     },
                  },
                  { $limit: 1 }
               ],
               as: "wishlistInfo",
            },
         },
         {
            $addFields: {
               liked: { $gt: [{ $size: "$wishlistInfo" }, 0] },
            },
         },

         {
            $addFields: {
               liked: { $gt: [{ $size: '$wishlistInfo' }, 0] },
            },
         },
      ];
   }

   private buildSearchPipeline(destination: string): PipelineStage[] {
      return [
         {
            $search: {
               index: process.env.MONGODB_SEARCH_INDEX || 'default',
               compound: {
                  should: [
                     {
                        text: {
                           query: destination,
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
                           query: destination,
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
                           query: destination,
                           path: 'location.country',
                           score: { boost: { value: 2 } },
                        },
                     },

                     {
                        text: {
                           query: destination,
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
            },
         },
         {
            $match: {
               status: PROPERTY_STATUS.ACTIVE,
               visibility: 'published',
            },
         },
      ];
   }

   private async buildFilterPipeline(
      filters: PropertyFilter,
   ): Promise<PipelineStage[]> {
      const pipeline: PipelineStage[] = [];

      if (filters.destination) {
         pipeline.push(...this.buildSearchPipeline(filters.destination));
      }

      pipeline.push({
         $match: { status: PROPERTY_STATUS.ACTIVE },
      });

      if (filters.experienceTags) {
         pipeline.push({ $match: { experienceTags: filters.experienceTags } });
      }
      if (filters.categoryName) {
         const category = await CategoryModel.findOne({
            name: { $regex: filters.categoryName, $options: 'i' },
         }).select('_id');

         if (category) {
            pipeline.push({ $match: { category: category._id } });
         }
      }

      if (filters.propertyType.length > 0) {
         pipeline.push({
            $match: { propertyType: { $in: filters.propertyType } },
         });
      }

      if (filters.typeOfPlace) {
         pipeline.push({
            $match: { propertyPlaceType: filters.typeOfPlace },
         });
      }

      return pipeline;
   }

   private buildAvailabilityPipeline(
      checkin: string,
      checkout: string,
   ): PipelineStage[] {
      const availableStart = moment.utc(checkin).startOf('day').toDate();

      return [
         {
            $match: {
               isBookable: true,
            },
         },
         // Lookup reservations to check for conflicts
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
                              {
                                 $in: [
                                    '$status',
                                    ['complete', 'processing', 'open'],
                                 ],
                              },
                           ],
                        },
                     },
                  },
               ],
               as: 'existingReservations',
            },
         },

         // Add fields to determine availability and conflicts

         {
            $addFields: {
               isWithinAvailability: {
                  $and: [
                     {
                        $lte: [
                           availableStart,
                           {
                              $dateAdd: {
                                 startDate: availableStart,
                                 unit: 'month',
                                 amount: '$availabilityWindow',
                              },
                           },
                        ],
                     },
                     {
                        $gte: [
                           {
                              $dateAdd: {
                                 startDate: availableStart,
                                 unit: 'month',
                                 amount: '$availabilityWindow',
                              },
                           },
                           availableStart,
                        ],
                     },
                  ],
               },
               hasConflicts: {
                  $anyElementTrue: {
                     $map: {
                        input: '$existingReservations',
                        as: 'reservation',
                        in: {
                           $and: [
                              {
                                 $lt: [
                                    { $toDate: checkin },
                                    '$$reservation.checkOutDate',
                                 ],
                              },
                              {
                                 $gt: [
                                    { $toDate: checkout },
                                    '$$reservation.checkInDate',
                                 ],
                              },
                           ],
                        },
                     },
                  },
               },
            },
         },
         {
            $match: {
               isWithinAvailability: true,
               hasConflicts: false,
            },
         },
      ];
   }
   private async buildPricePipeline(
      nights: number,
      minPrice?: number,
      maxPrice?: number
   ) {

      const guestCurrency = this.currency.toLowerCase();
      const today = moment.utc(new Date()).startOf('date').toDate()

      const [basePriceConverted, dailyPriceConverted] = await Promise.all([
         generatePipeForCurrencyConversion(
            {
               baseAmountAttribute: '$price.basePrice.amount',
               baseCurrencyAttribute: "$price.basePrice.currency",
               includeExchangeRate: true,
               requestCurrency: guestCurrency,
               outputField: "covertedBasePrice"
            }
         ),
         generatePipeForCurrencyConversion(
            {
               baseAmountAttribute: '$avgNightlyRate',
               baseCurrencyAttribute: "$price.basePrice.currency",
               includeExchangeRate: false,
               requestCurrency: guestCurrency,
               outputField: "avgNightlyRateConverted"
            }
         )

      ])
      const pipeline: PipelineStage[] = [
         {
            $lookup: {
               from: "prices",
               localField: "price",
               foreignField: "_id",
               pipeline: [{ $project: { basePrice: 1, dailyRates: 1 } }],
               as: "price",
            },
         },
         { $unwind: "$price" },
         ...basePriceConverted,

         // bring reservations
         {
            $lookup: {
               from: "reservations",
               let: { propertyId: "$_id" },
               pipeline: [
                  {
                     $match: {
                        $expr: {
                           $and: [
                              { $eq: ["$propertyId", "$$propertyId"] },
                              { $ne: ["$status", "cancelled"] },
                              { $lte: ["$checkInDate", today] },
                              { $gt: ["$checkOutDate", today] }
                           ]
                        }
                     }
                  },
                  { $project: { checkInDate: 1, checkOutDate: 1 } },
                  { $sort: { checkInDate: 1 } }
               ],
               as: "reservations"
            }
         },

         // find nearest available gap >= nights
         {
            $addFields: {
               nearestAvailable: {
                  $let: {
                     vars: { res: "$reservations" },
                     in: {
                        $first: {
                           $filter: {
                              input: {
                                 $map: {
                                    input: { $range: [0, { $add: [{ $size: "$$res" }, 1] }] },
                                    as: "idx",
                                    in: {
                                       startDate: {
                                          $max: [
                                             "$$NOW",
                                             {
                                                $cond: [
                                                   { $eq: ["$$idx", 0] },
                                                   "$$NOW",
                                                   { $arrayElemAt: ["$$res.checkOutDate", { $subtract: ["$$idx", 1] }] }
                                                ]
                                             }
                                          ]
                                       },
                                       endDate: {
                                          $cond: [
                                             { $lt: ["$$idx", { $size: "$$res" }] },
                                             { $arrayElemAt: ["$$res.checkInDate", "$$idx"] },
                                             null
                                          ]
                                       }
                                    }
                                 }
                              },
                              as: "gap",
                              cond: {
                                 $or: [
                                    {
                                       $and: [
                                          { $ne: ["$$gap.endDate", null] },
                                          {
                                             $gte: [
                                                { $dateDiff: { startDate: "$$gap.startDate", endDate: "$$gap.endDate", unit: "day" } },
                                                nights
                                             ]
                                          }
                                       ]
                                    },
                                    { $eq: ["$$gap.endDate", null] }
                                 ]
                              }
                           }
                        }
                     }
                  }
               }
            }
         },

         // filter daily rates intersecting with that gap
         {
            $addFields: {
               dailyRatesForGap: {
                  $filter: {
                     input: "$price.dailyRates",
                     as: "rate",
                     cond: {
                        $and: [
                           {
                              $lt: ["$$rate.startDate", {
                                 $dateAdd: {
                                    startDate: "$nearestAvailable.startDate",
                                    unit: "day",
                                    amount: nights
                                 }
                              }]
                           },
                           { $gt: ["$$rate.endDate", "$nearestAvailable.startDate"] }
                        ]
                     }
                  }
               }
            }
         },

         // nightly breakdown for N nights dynamically
         {
            $addFields: {
               nightlyBreakdown: {
                  $map: {
                     input: { $range: [0, nights] },
                     as: "offset",
                     in: {
                        $let: {
                           vars: {
                              currentDate: {
                                 $dateAdd: {
                                    startDate: "$nearestAvailable.startDate",
                                    unit: "day",
                                    amount: "$$offset"
                                 }
                              },
                              basePrice: "$price.basePrice.amount",
                              dailyRates: "$dailyRatesForGap"
                           },
                           in: {
                              $let: {
                                 vars: {
                                    matchingRate: {
                                       $arrayElemAt: [
                                          {
                                             $filter: {
                                                input: "$$dailyRates",
                                                as: "rate",
                                                cond: {
                                                   $and: [
                                                      { $lte: ["$$rate.startDate", "$$currentDate"] },
                                                      { $gt: ["$$rate.endDate", "$$currentDate"] }
                                                   ]
                                                }
                                             }
                                          },
                                          0
                                       ]
                                    }
                                 },
                                 in: { $ifNull: ["$$matchingRate.price", "$$basePrice"] }
                              }
                           }
                        }
                     }
                  }
               }
            }
         },

         // average nightly
         {
            $addFields: {
               avgNightlyRate: { $avg: "$nightlyBreakdown" }
            }
         },

         ...dailyPriceConverted,

         // final price for N nights
         {
            $addFields: {
               price: {
                  amount: {
                     $round: [
                        { $multiply: ["$avgNightlyRateConverted", nights] },
                        0
                     ]
                  },
                  currency: guestCurrency.toUpperCase(),
                  nearestAvailable: {
                     startDate: "$nearestAvailable.startDate",
                     endDate: {
                        $dateAdd: {
                           startDate: "$nearestAvailable.startDate",
                           unit: "day",
                           amount: nights
                        }
                     },
                     nights,
                     avgNightly: { $round: ["$avgNightlyRateConverted", 0] },
                     currency: guestCurrency.toUpperCase()
                  }
               }
            }
         },
         {
            $project: {
               reservations: 0,
               dailyRatesForGap: 0
            }
         }
      ];

      if (minPrice || maxPrice) {
         const match = {};
         if (minPrice) match["price.amount"] = { $gte: minPrice };
         if (maxPrice) {
            match["price.amount"] = {
               ...(match["price.amount"] || {}),
               $lte: maxPrice,
            };
         }
         pipeline.push({ $match: match });
      }

      return pipeline;
   }



   private buildDetailsPipeline(filters: PropertyFilter): PipelineStage[] {
      const pipeline: PipelineStage[] = [];

      if (filters.bed) {
         pipeline.push({
            $match: { 'details.beds': { $gte: Number(filters.bed) } },
         });
      }

      if (filters.bedrooms) {
         pipeline.push({
            $match: { 'details.bedRooms': { $gte: Number(filters.bedrooms) } },
         });
      }

      if (filters.bathrooms) {
         pipeline.push({
            $match: {
               'details.bathRooms': { $gte: Number(filters.bathrooms) },
            },
         });
      }

      if (filters.guest) {
         pipeline.push({
            $match: { 'capacity.maxGuest': { $gte: Number(filters.guest) } },
         });
      }

      return pipeline;
   }

   private buildAmenitiesPipeline(amenities?: string[]) {
      const pipeline: PipelineStage[] = [
         {
            $lookup: {
               from: 'amenities',
               localField: 'amenities',
               foreignField: '_id',
               pipeline: [
                  { $limit: 3 },
                  {
                     $project: {
                        title: 1,
                        icon: 1,
                     },
                  },
               ],
               as: 'amenitiesDetails',
            },
         },
      ];

      if (amenities.length > 0) {
         pipeline.push({
            $match: {
               'amenitiesDetails.title': {
                  $in: amenities,
               },
            },
         });
      }
      return pipeline;
   }

   private buildPaginationPipeline(
      pagination: PaginationAttributes,
   ): PipelineStage[] {
      return [
         {
            $facet: {
               totalCount: [{ $count: 'count' }],
               properties: [
                  { $skip: pagination.startIndex },
                  { $limit: pagination.limit },
                  {
                     $project: {
                        title: 1,
                        avgRating: 1,
                        'location.city': 1,
                        'location.country': 1,
                        'location.state': 1,
                        'location.coordinates': 1,
                        gallery: 1,
                        'details.bathRooms': 1,
                        'details.bedRooms': 1,
                        'details.beds': 1,
                        amenities: '$amenitiesDetails',
                        // availability: 1,
                        "price.amount": 1,
                        "price.currency": 1,
                        'price.nearestAvailable': 1,
                        propertyPlaceType: 1,
                        propertyType: 1,
                        liked: 1,
                        capacity: 1,
                        // price: 1
                        // availabilityEndDate: 1,
                        // // Remove fields we added for filtering purposes
                        // isWithinAvailability: 1,
                        // hasConflicts: 1,
                        // existingReservations: 1,
                     },
                  },
               ],
            },
         },
      ];
   }

   public async getFilteredProperties(
      filters: PropertyFilter,
      pagination: PaginationAttributes,
      userId?: mongoose.Types.ObjectId,
   ) {
      if (filters.checkin && filters.checkout) {
         await this.validateDates(filters.checkin, filters.checkout);
      }

      const pipeline: PipelineStage[] = [
         ...(await this.buildFilterPipeline(filters)),
         ...(filters.checkin && filters.checkout
            ? this.buildAvailabilityPipeline(filters.checkin, filters.checkout)
            : []),
         ...(await this.buildPricePipeline(filters?.nights ? Number(filters?.nights) : 2, Number(filters.minPrice), Number(filters.maxPrice))),
         ...this.buildDetailsPipeline(filters),
         ...this.buildAmenitiesPipeline(filters.amenities),
         ...this.buildWishListPipeline(userId),
         ...this.buildPaginationPipeline(pagination),
      ];
      const [result] = await Property.aggregate(pipeline);

      // await getMongoQueryRunTimePlan(Property, pipeline,)
      // Extract properties and total count from the aggregation result
      const properties = result.properties;
      const totalCount: number = result?.totalCount[0]?.count || 0;

      return formatPaginationResponse(properties, totalCount, pagination);
   }
}
