import mongoose, { PipelineStage } from 'mongoose';
import { ApiError } from '../../../../utils/error-handlers/ApiError';
import { Category } from '../../../../models/category/category';
import { Property } from '../../../../models/property/property';
import { dateRegex } from '../../../../utils/regex/regex.constant';
import { getBlockDates } from './general.property.utils';
import { formatPaginationResponse } from '../../../../utils/pagination/pagination.utils';
import { IProperty } from '../../../../models/property/types/property.model.types';
export interface PropertyFilter {
   status?: string;
   categoryName?: string;
   experienceTags?: string;
   typeOfPlace?: string;
   propertyType?: string[];
   checkin?: string;
   checkout?: string;
   guest?: number;
   destination?: string;
   amenities?: string[];
   bed?: number;
   bedrooms?: number;
   minPrice?: number;
   maxPrice?: number;
   bathrooms?: number;
}

interface PaginationAttributes {
   startIndex: number;
   endIndex: number;
   page: number;
   limit: number;
}

export class PropertyService {
   private isDemandedForAvailabilty = false;

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
      return [
         {
            $lookup: {
               from: 'wishlists',
               let: { propertyId: '$_id' },
               pipeline: [
                  {
                     $match: {
                        $expr: {
                           $and: [
                              { $eq: ['$userId', userId] },
                              { $eq: ['$propertyId', '$$propertyId'] },
                           ],
                        },
                     },
                  },
               ],
               as: 'wishlistInfo',
            },
         },
         {
            $addFields: {
               liked: { $gt: [{ $size: '$wishlistInfo' }, 0] }, // If wishlistInfo has items, `liked` is true
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
         $match: { status: 'active' },
      });
      if (filters.experienceTags) {
         pipeline.push({ $match: { experienceTags: filters.experienceTags } });
      }
      if (filters.categoryName) {
         const category = await Category.findOne({
            name: { $regex: filters.categoryName, $options: 'i' },
         });
         if (!category) {
            throw new ApiError(404, 'Category not found.');
         }
         pipeline.push({ $match: { category: category._id } });
      }

      if (filters.propertyType && Array.isArray(filters.propertyType)) {
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
      this.isDemandedForAvailabilty = true;
      const availableStart = new Date();
      availableStart.setUTCHours(0, 0, 0, 0);

      return [
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
                           $or: [
                              // Check if the requested dates overlap with existing reservation
                              {
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
                              // // Request dates partially overlap with start of existing reservation
                              // {
                              //    $and: [
                              //       {
                              //          $lt: [
                              //             { $toDate: checkin },
                              //             '$$reservation.checkInDate',
                              //          ],
                              //       },
                              //       {
                              //          $gte: [
                              //             { $toDate: checkout },
                              //             '$$reservation.checkInDate',
                              //          ],
                              //       },
                              //       {
                              //          $lt: [
                              //             { $toDate: checkout },
                              //             '$$reservation.checkOutDate',
                              //          ],
                              //       },
                              //    ],
                              // },
                              // // Request dates partially overlap with end of existing reservation
                              // {
                              //    $and: [
                              //       {
                              //          $gt: [
                              //             { $toDate: checkin },
                              //             '$$reservation.checkInDate',
                              //          ],
                              //       },
                              //       {
                              //          $lt: [
                              //             { $toDate: checkin },
                              //             '$$reservation.checkOutDate',
                              //          ],
                              //       },
                              //       {
                              //          $gt: [
                              //             { $toDate: checkout },
                              //             '$$reservation.checkOutDate',
                              //          ],
                              //       },
                              //    ],
                              // },
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

   private buildPricePipeline(
      minPrice?: number,
      maxPrice?: number,
   ): PipelineStage[] {
      const pipeline: PipelineStage[] = [
         {
            $lookup: {
               from: 'prices',
               localField: 'price',
               foreignField: '_id',
               as: 'price',
            },
         },
      ];

      if (minPrice || maxPrice) {
         const priceFilter = {};

         if (minPrice) {
            priceFilter['price.basePrice.amount'] = { $gte: Number(minPrice) };
         }
         if (maxPrice) {
            if (priceFilter['price.basePrice.amount']) {
               priceFilter['price.basePrice.amount'].$lte = Number(maxPrice);
            } else {
               priceFilter['price.basePrice.amount'] = {
                  $lte: Number(maxPrice),
               };
            }
         }

         pipeline.push({
            $match: priceFilter,
         });
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
               as: 'amenitiesDetails',
            },
         },
      ];
      if (amenities && Array.isArray(amenities)) {
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
                        location: 1,
                        gallery: 1,
                        details: 1,
                        amenities: '$amenitiesDetails',
                        availability: 1,
                        price: { $arrayElemAt: ['$price.basePrice', 0] }, // Extracts single price value
                        liked: 1,
                        capacity: 1,
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
         ...this.buildPricePipeline(filters.minPrice, filters.maxPrice),
         ...this.buildDetailsPipeline(filters),
         ...this.buildAmenitiesPipeline(filters.amenities),
         ...this.buildWishListPipeline(userId),
         ...this.buildPaginationPipeline(pagination),
      ];
      const [result] = await Property.aggregate(pipeline);
      // Extract properties and total count from the aggregation result
      let properties: IProperty[] = result.properties;
      const totalCount: number = result.totalCount[0]?.count || 0;

      // If availability is demanded, enhance each property with availability data
      if (!this.isDemandedForAvailabilty) {
         properties = await Promise.all(
            result.properties.map(async (property) => ({
               ...property,
               blockDates: await getBlockDates(property._id),
            })),
         );
      }
      return formatPaginationResponse(properties, totalCount, pagination);
   }
}
