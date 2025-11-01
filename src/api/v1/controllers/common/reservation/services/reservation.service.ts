import mongoose, { PipelineStage } from 'mongoose';
import { Reservation } from '../../../../models/reservation/reservation';
import { formatPaginationResponse } from '../../../../utils/pagination/pagination.utils';
import moment from 'moment';

export async function getFilteredReservations(pagesAttr, query, filter) {
   const { sortField, sortOrder, searchTerm, status, startDate, endDate } = query as {
      sortField?: string;
      sortOrder: string;
      searchTerm: string;
      status: string;
      startDate: string,
      endDate: string
   };

   const now = moment.utc(new Date()).startOf('date').toDate()

   const sortDirection = sortOrder === 'desc' ? -1 : 1;


   let filterMatch = { ...filter, };



   if (startDate && endDate) {
      const start = moment.utc(startDate).startOf('day');;
      const end = moment.utc(endDate).startOf('day');

      if (start.isValid() && end.isValid() && !start.isAfter(end)) {
         filterMatch = {
            ...filterMatch,
            checkInDate: { $gte: start.toDate() },
            checkOutDate: { $lte: end.toDate() }
         };

      } else {
         console.warn("Invalid date range or startDate > endDate");
      }
   }



   const conditionMap = {

      open: {
         status: { $eq: 'awaiting_confirmation' }
      },

      ariving_today: {
         status: { $eq: 'complete' },
         checkInDate: { $eq: now }
      },

      departure_today: {
         status: { $eq: 'complete' },
         checkOutDate: { $eq: now }
      },
      ongoing: {
         status: { $eq: 'complete' },
         checkInDate: { $lte: now },
         checkOutDate: { $gte: now },
      },
      complete: {
         status: { $eq: 'complete' },
      },
      cancelled: {
         status: 'cancelled',
      },
      all: {
         status: { $ne: 'open' }
      }

   }
   filterMatch = { ...conditionMap[status], ...filterMatch }

   const searchFilters: Record<string, unknown> = {};
   if (searchTerm) {
      const regex = { $regex: searchTerm, $options: 'i' };
      const fieldsToSearch = [
         'userDetails.fullName',
         'userDetails.email',
         'propertyDetails.title',
         'reservationCode',
         'userDetails.phone.number'
      ];

      searchFilters.$or = fieldsToSearch.map((field) => ({
         [field]: regex,
      }));
   }


   const pipeline: PipelineStage[] = [
      { $match: filterMatch },
      {
         $lookup: {
            from: 'properties',
            localField: 'propertyId',
            foreignField: '_id',
            pipeline: [
               // {
               //    $match: {
               //       status: propertyStatus
               //    }
               // },
               {
                  $project: {
                     title: 1,
                     thumbnail: 1
                  },
               },
            ],
            as: 'propertyDetails',
         },
      },
      {
         $unwind: {
            path: '$propertyDetails',
            preserveNullAndEmptyArrays: false,
         },
      },
      {
         $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            pipeline: [
               {
                  $addFields: {
                     fullName: { $concat: ['$firstName', ' ', '$lastName'] }
                  }
               },
               {
                  $project: {
                     _id: 0,
                     firstName: 1,
                     fullName: 1,
                     lastName: 1,
                     phone: 1,
                     address: 1,
                     email: 1
                  }
               }
            ],

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
         $lookup: {
            from: 'billings',
            localField: '_id',
            foreignField: 'reservationId',
            pipeline: [
               {
                  $project: {
                     pricePerNight: 1,
                     numberOfNights: 1,
                     totalPrice: 1,
                     totalAmountPaid: 1,
                     remainingAmount: 1,
                     currencyExchangeRate: 1
                  },
               },
            ],
            as: 'billing',
         },
      },
      {
         $unwind: {
            path: '$billing',
            preserveNullAndEmptyArrays: true,
         },
      },

      { $match: searchFilters },
   ];

   // Sorting logic
   const sortFieldsMap = {
      pricePerNight: 'billing.pricePerNight',
      numberOfNights: 'billing.numberOfNights',
      firstName: 'userDetails.firstName',
      propertyTitle: 'propertyDetails.title',
      checkInDate: 'checkInDate',
      checkOutDate: 'checkOutDate',
      createdAt: 'createdAt',
   };
   pipeline.push({
      $addFields: {
         billing: {
            numberOfNights: {
               $ifNull: [
                  "$billing.numberOfNights",
                  { $dateDiff: { startDate: "$checkInDate", endDate: "$checkOutDate", unit: "day" } }
               ]
            }
         }
      }
   });


   if (sortField) {
      const sortTargetField = sortFieldsMap[sortField];

      pipeline.push({
         $addFields: {
            sortFieldValue: {
               $ifNull: [`$${sortTargetField}`, -1],
            },
         },
      });

      pipeline.push({
         $sort: { [sortTargetField]: sortDirection },
      });
   }

   pipeline.push({ $skip: pagesAttr.startIndex }, { $limit: pagesAttr.limit });
   pipeline.push({
      $project: {
         sortFieldValue: 0,
      },
   });

   // Updated count query using aggregation to match searchTerm
   const countPipeline: PipelineStage[] = [
      { $match: filterMatch },

      {
         $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            pipeline: [
               {
                  $addFields: {
                     fullName: { $concat: ['$firstName', ' ', '$lastName'] }
                  }
               },
               {
                  $project: {
                     _id: 1,
                     email: 1,
                     phone: 1,
                     fullName: 1,
                  }
               }
            ],
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
         $lookup: {
            from: 'properties',
            localField: 'propertyId',
            foreignField: '_id',
            pipeline: [
               {
                  $project: {
                     title: 1,
                  },
               },
            ],
            as: 'propertyDetails',
         },
      },
      {
         $unwind: {
            path: '$propertyDetails',
            preserveNullAndEmptyArrays: false,
         },
      },
      { $match: searchFilters },

      { $count: 'totalCount' },
   ];

   const reservationAggregation = Reservation.aggregate(pipeline);

   const countAggregation = Reservation.aggregate(countPipeline);

   const [reservationList, countResult] = await Promise.all([
      reservationAggregation,
      countAggregation,
   ]);

   const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;

   const result = formatPaginationResponse(
      reservationList,
      totalCount,
      pagesAttr,
   );

   return {
      pagination: result?.pagination,
      reservations: result?.result,
   };
}

export async function getEntireReservationDetailsById(
   filter: Partial<{
      _id: mongoose.Types.ObjectId;
      hostId: mongoose.Types.ObjectId;
   }> = {},
) {
   try {
      const today = moment.utc(new Date()).startOf('date').toDate()
      const reservation = await Reservation.aggregate([
         {
            $match: filter,
         },
         {
            $facet: {
               selfBooked: [
                  { $match: { isSelfBooked: true } },
                  {
                     $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        pipeline: [
                           {
                              $project: {
                                 name: {
                                    $concat: ['$firstName', ' ', '$lastName'],
                                 },
                                 email: 1,
                                 phone: '$phone.number',
                              },
                           },
                        ],
                        as: 'billing.guestDetails',
                     },
                  },
                  {
                     $unwind: {
                        path: '$billing.guestDetails',
                        preserveNullAndEmptyArrays: false,
                     },
                  },

                  {
                     $addFields: {
                        'billing.numberOfNights': {

                           $dateDiff: {
                              startDate: '$checkInDate',
                              endDate: '$checkOutDate',
                              unit: 'day',
                           },
                        },
                     },
                  },
               ],
               userBooked: [
                  { $match: { isSelfBooked: false } },
                  {
                     $lookup: {
                        from: 'billings',
                        localField: '_id',
                        foreignField: 'reservationId',
                        as: 'billing',
                     },
                  },
                  {
                     $unwind: {
                        path: '$billing',
                        preserveNullAndEmptyArrays: true,
                     },
                  },
                  {
                     $lookup: {
                        from: 'transactions',
                        let: { reservationId: '$_id' },
                        pipeline: [
                           {
                              $match: {
                                 $expr: {
                                    $eq: ['$reservationId', '$$reservationId'],
                                 },
                              },
                           },
                           {
                              $lookup: {
                                 from: 'transactions',
                                 localField: 'referenceTxn',
                                 foreignField: '_id',
                                 pipeline: [
                                    {
                                       $project: {
                                          type: 1,
                                          paymentAmount: 1,
                                          paymentStatus: 1,
                                          paymentMethod: 1,
                                          transactionCode: 1,
                                       },
                                    },
                                 ],
                                 as: 'refTransaction',
                              },
                           },
                           {
                              $unwind: {
                                 path: '$refTransaction',
                                 preserveNullAndEmptyArrays: true,
                              },
                           },
                        ],
                        as: 'transactions',
                     },
                  },
               ],
            },
         },
         {
            $project: {
               result: { $concatArrays: ['$selfBooked', '$userBooked'] },
            },
         },
         { $unwind: { path: '$result', preserveNullAndEmptyArrays: false } },
         { $replaceRoot: { newRoot: '$result' } },
         {
            $lookup: {
               from: 'properties',
               localField: 'propertyId',
               foreignField: '_id',
               pipeline: [
                  {
                     $project: {
                        title: 1,
                        propertyType: 1,
                        propertyPlaceType: 1,
                        thumbnail: 1,
                        location: 1,
                     },
                  },
               ],
               as: 'propertyDetails',
            },
         },
         {
            $unwind: {
               path: '$propertyDetails',
               preserveNullAndEmptyArrays: true,
            },
         },
         {
            $addFields: {
               cancellationAllowed: {
                  $and: [
                     { $gte: ["$checkInDate", today] },
                     { $ne: ["$status", "cancelled"] },
                     { $eq: ["$isSelfBooked", false] }
                  ]
               }
            }
         }

      ]);

      return reservation[0] || {};
   } catch (err) {
      console.log(err);
      return {};
   }
}


interface ICheckActiveReservation {
   propertyId: mongoose.Types.ObjectId,

}

export async function checkActiveReservation(options: ICheckActiveReservation) {
   const { propertyId } = options
   const now = moment.utc(new Date).startOf('day').toDate()
   const reservation = await Reservation.findOne({
      propertyId,
      $or: [
         { checkInDate: { $lte: now }, checkOutDate: { $gte: now } },
         { checkInDate: { $gte: now } }
      ]
   }).select('_id');


   return Boolean(reservation)
}