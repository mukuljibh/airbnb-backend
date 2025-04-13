import { Property } from '../../models/property/property';
import mongoose from 'mongoose';

export type IAvailabilityDates = {
   dates: {
      available_ranges: {
         start_date: Date;
         end_date: Date;
      }[];
   }[];
}[];
export default async function getLatestAvailablity<T>(
   id: mongoose.Types.ObjectId,
) {
   return (await Property.aggregate([
      // Match specific property
      {
         $match: {
            _id: id,
         },
      },
      // Unwind the availability array
      {
         $unwind: '$availability',
      },
      // Lookup to join reservations for each property
      {
         $lookup: {
            from: 'reservations',
            localField: '_id',
            foreignField: 'property_id',
            as: 'reservations',
         },
      },
      // Unwind reservations (if any)
      {
         $unwind: {
            path: '$reservations',
            preserveNullAndEmptyArrays: true,
         },
      },
      // Use $facet to compute both overlapping and non-overlapping reservations
      {
         $facet: {
            non_overlapping: [
               {
                  $match: {
                     $expr: {
                        $or: [
                           {
                              $gt: [
                                 '$reservations.check_in_date',
                                 '$availability.end_date',
                              ],
                           },
                           {
                              $lt: [
                                 '$reservations.check_out_date',
                                 '$availability.start_date',
                              ],
                           },
                        ],
                     },
                  },
               },
               {
                  $group: {
                     _id: '$availability.start_date',
                     available_ranges: { $addToSet: '$availability' },
                  },
               },
               {
                  $project: {
                     _id: 0,
                     available_ranges: 1,
                  },
               },
            ],
            overlapping: [
               {
                  $match: {
                     $expr: {
                        $and: [
                           {
                              $lte: [
                                 '$reservations.check_in_date',
                                 '$availability.end_date',
                              ],
                           },
                           {
                              $gte: [
                                 '$reservations.check_out_date',
                                 '$availability.start_date',
                              ],
                           },
                        ],
                     },
                  },
               },
               // Sort reservations by check-in date
               {
                  $sort: { 'reservations.check_in_date': 1 },
               },
               // Group by property and availability to compute available ranges
               {
                  $group: {
                     _id: {
                        property_id: '$_id',
                        availability_start: '$availability.start_date',
                        availability_end: '$availability.end_date',
                     },
                     reservations: { $push: '$reservations' },
                  },
               },
               // Add a field to compute available ranges
               {
                  $addFields: {
                     available_ranges: {
                        $reduce: {
                           input: '$reservations',
                           initialValue: [
                              {
                                 start_date: '$_id.availability_start',
                                 end_date: '$_id.availability_end',
                              },
                           ],
                           in: {
                              $let: {
                                 vars: {
                                    lastRange: {
                                       $arrayElemAt: ['$$value', -1],
                                    },
                                    resStart: '$$this.check_in_date',
                                    resEnd: '$$this.check_out_date',
                                 },
                                 in: {
                                    $concatArrays: [
                                       {
                                          $slice: [
                                             '$$value',
                                             {
                                                $subtract: [
                                                   { $size: '$$value' },
                                                   1,
                                                ],
                                             },
                                          ],
                                       },
                                       [
                                          {
                                             start_date:
                                                '$$lastRange.start_date',
                                             end_date: {
                                                $subtract: [
                                                   '$$resStart',
                                                   1 * 24 * 60 * 60 * 1000,
                                                ],
                                             },
                                          },
                                          {
                                             start_date: {
                                                $add: [
                                                   '$$resEnd',
                                                   1 * 24 * 60 * 60 * 1000,
                                                ],
                                             },
                                             end_date: '$$lastRange.end_date',
                                          },
                                       ],
                                    ],
                                 },
                              },
                           },
                        },
                     },
                  },
               },
               // Unwind the available_ranges array
               {
                  $unwind: '$available_ranges',
               },
               // Filter out invalid ranges (where start_date > end_date)
               {
                  $match: {
                     $expr: {
                        $lte: [
                           '$available_ranges.start_date',
                           '$available_ranges.end_date',
                        ],
                     },
                  },
               },
               // Group by property to collect all available ranges
               {
                  $group: {
                     _id: '$_id.property_id',
                     available_ranges: { $push: '$available_ranges' },
                  },
               },
               // Project the final output
               {
                  $project: {
                     _id: 0,
                     available_ranges: 1,
                  },
               },
            ],
         },
      },
      {
         $project: {
            _id: 0,
            dates: {
               $concatArrays: ['$non_overlapping', '$overlapping'],
            },
         },
      },
   ])) as T;
}
