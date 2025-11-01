import { Request, Response, NextFunction } from 'express';
import { Reservation } from '../../../models/reservation/reservation';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import Stripe from 'stripe';
import { validateObjectId, withMongoTransaction } from '../../../utils/mongo-helper/mongo.utils';
import { PaymentService } from './services/reservation.service';
import { Transaction } from '../../../models/reservation/transaction';
import { PipelineStage } from 'mongoose';
import { Property } from '../../../models/property/property';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { EventLogs } from '../../../models/reservation/eventLogs';
import { User } from '../../../models/user/user';
import { JobQueues } from '../../../models/jobQueues';
import { handleCancelOrder } from './services/payment.service';
import * as commonReservationUtils from '../../common/reservation/services/reservation.service';
import { getFilteredReservations } from '../../common/reservation/services/reservation.service';
import { stripe } from '../../../config/stripe';
import mongoose from 'mongoose';
import moment from 'moment-timezone';
import { schedulePaymentJob } from '../../../workers/payments/jobs';
import { PROPERTY_STATUS } from '../../../models/property/propertyAttributes/propertyAttributes';
import env from '../../../config/env';
import { agenda } from '../../../config/agenda';
import { reservationDefines } from './jobs/defines/reservation.define';

export async function getAllUserReservation(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { pagination } = res.locals;

   const today = moment.utc(new Date()).startOf('date').toDate()

   const user = req.user as ISessionUser;

   const status = req.query?.status as 'upcoming' | 'completed' | 'cancelled' | 'ongoing' | 'all';
   const now = moment.utc().toDate();

   let statusMatchStage = {};

   const conditionMap = {
      upcoming: {
         status: { $nin: ['processing', 'cancelled'] },
         $or: [
            { checkInDate: { $gt: now } },
            {
               checkInDate: { $lte: now },
               checkOutDate: { $gte: now }
            }
         ]
      },
      ongoing: {
         status: { $nin: ['processing', 'cancelled'] },
         checkInDate: { $lte: now },
         checkOutDate: { $gte: now },
      },
      completed: {
         status: 'complete',
         checkOutDate: { $lt: now },
      },
      cancelled: {
         status: 'cancelled',
      }

   }
   if (status !== 'all') {
      statusMatchStage = conditionMap[status]
   }

   const filter = {
      userId: user._id,
      isSelfBooked: false,
      ...statusMatchStage,
   }

   let sortingCriteria: Record<string, any> = { createdAt: -1, sortOrder: 1 }
   if (status === 'cancelled') {
      sortingCriteria = { cancelledAt: -1, sortOrder: 1 }
   }
   try {
      const pipeline: PipelineStage[] = [
         { $match: filter },

         {
            $addFields: {
               sortOrder: {
                  $switch: {
                     branches: [
                        { case: { $eq: ['$status', 'open'] }, then: 1 },
                        { case: { $in: ['$status', ['awaiting_confirmation', 'complete', 'processing']] }, then: 2 },
                        { case: { $eq: ['$status', 'cancelled'] }, then: 3 },
                     ],
                     default: 4,
                  },
               },
            },
         },

         { $sort: sortingCriteria },
         { $skip: pagination.startIndex },
         { $limit: pagination.limit },
         {
            $addFields: {
               status: {
                  $switch: {
                     branches: [
                        { case: { $eq: ['$status', 'open'] }, then: 'open' },
                        { case: { $eq: ['$status', 'cancelled'] }, then: 'cancelled' },
                        { case: { $eq: ['$status', 'awaiting_confirmation'] }, then: 'awaiting_confirmation' },
                        {
                           case: {
                              $and: [
                                 { $lte: ['$checkInDate', now] },
                                 { $gte: ['$checkOutDate', now] },
                                 { $not: [{ $in: ['$status', ['processing', 'cancelled']] }] },
                              ],
                           },
                           then: 'ongoing',
                        },
                        {
                           case: {
                              $and: [
                                 { $gt: ['$checkInDate', now] },
                                 { $not: [{ $in: ['$status', ['processing', 'cancelled']] }] },
                              ],
                           },
                           then: 'upcoming',
                        },
                        {
                           case: {
                              $and: [
                                 { $eq: ['$status', 'complete'] },
                                 { $lt: ['$checkOutDate', now] },
                              ],
                           },
                           then: 'completed',
                        },
                     ],
                     default: 'other',
                  },
               },
            },
         },
         {
            $lookup: {
               from: 'properties',
               localField: 'propertyId',
               foreignField: '_id',
               as: 'property',
            },
         },
         { $unwind: '$property' },
         {
            $lookup: {
               from: 'users',
               localField: 'property.hostId',
               foreignField: '_id',
               as: 'host',
            },
         },
         { $unwind: '$host' },
         {
            $lookup: {
               let: { userId: user._id, reservationId: '$_id', propertyId: '$propertyId' },
               from: 'reviews',
               pipeline: [
                  {
                     $match: {
                        $expr: {
                           $and: [
                              { $eq: ['$userId', '$$userId'] },
                              { $eq: ['$reservationId', '$$reservationId'] },
                              { $eq: ['$propertyId', '$$propertyId'] },
                           ],
                        },
                     },
                  },
               ],
               as: 'review',
            },
         },
         { $unwind: { path: '$review', preserveNullAndEmptyArrays: true } },

         {
            $addFields: {
               hasReview: { $cond: [{ $ifNull: ['$review', false] }, true, false] },
               isReviewAllowed: {
                  $cond: {
                     if: { $in: ['$status', ['completed', 'cancelled']] },
                     then: {
                        $cond: {
                           if: { $ifNull: ['$review.reviewedAt', false] },
                           then: {
                              $gte: [
                                 '$review.reviewedAt',
                                 { $dateSubtract: { startDate: today, unit: 'day', amount: 2 } }
                              ]
                           },
                           else: true
                        }
                     },
                     else: false
                  }
               }
            },
         },
         {
            $project: {
               _id: 0,
               reservationId: '$_id',
               property: {
                  id: '$property._id',
                  title: '$property.title',
                  thumbnail: '$property.thumbnail',
                  hostDetails: {
                     id: '$host._id',
                     firstName: '$host.firstName',
                     lastName: '$host.lastName',
                  },
               },
               status: 1,
               hasReview: 1,
               checkInDate: 1,
               checkOutDate: 1,
               isReviewAllowed: 1,
               review: 1,
               confirmedAt: 1,
               cancelledAt: 1,
               createdAt: 1,
               sortOrder: 1,
            },
         },
      ];


      const reservationPromise = Reservation.aggregate(pipeline);
      const countPromise = Reservation.countDocuments(filter);

      const [results, totalCount] = await Promise.all([reservationPromise, countPromise])
      const result = formatPaginationResponse(results, totalCount, pagination);
      return res.json(result);
   } catch (err) {
      return next(err);
   }
}

export async function getPastReservations(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const pagesAttr = res.locals.pagination;

   try {
      const user = req.user as ISessionUser;
      const filter = {
         userId: user._id,
         status: 'complete',
         isSelfBooked: false,
         checkOutDate: { $lte: moment.utc(new Date()).toDate() },
      };
      const results = await Reservation.aggregate([
         {
            $match: filter,
         },
         {
            $lookup: {
               from: 'properties',
               localField: 'propertyId',
               foreignField: '_id',
               as: 'property',
            },
         },
         { $unwind: '$property' },

         {
            $lookup: {
               from: 'reviews',
               localField: 'propertyId',
               foreignField: 'propertyId',
               pipeline: [
                  {
                     $match: {
                        userId: user._id,
                     },
                  },
               ],
               as: 'review',
            },
         },
         {
            $unwind: {
               path: '$review',
               preserveNullAndEmptyArrays: true,
            },
         },
         {
            $project: {
               _id: 0,
               reservationId: '$_id',
               property: {
                  id: '$property._id',
                  title: '$property.title',
                  thumbnail: '$property.thumbnail',
               },
               checkInDate: 1,
               checkOutDate: 1,
               'review.content': 1,
               'review.rating': 1,
            },
         },

         { $sort: { checkOutDate: -1 } },
         { $skip: pagesAttr.startIndex },
         { $limit: pagesAttr.limit },
      ]);
      const totalCount = await Reservation.countDocuments(filter);
      const result = formatPaginationResponse(results, totalCount, pagesAttr);
      res.json(result);
   } catch (err) {
      next(err);
   }
}

export async function intiateReservationPayments(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const {
      checkIn,
      checkOut,
      child,
      adult,
      promoCode,
   }: Partial<{
      checkIn: Date;
      checkOut: Date;
      child: number;
      adult: number;
      promoCode?: string;
   }> = req.query;
   const currency = res.locals.currency
   const clientType = req.headers['client-type'] as 'Mobile' | undefined;
   const guestDetails = req.body;
   let paymentAttributes;
   const sessionUser = req.user as ISessionUser;

   try {
      const user = await User.findById(sessionUser._id);


      if (user.status === "suspended") {
         throw new ApiError(
            409,
            'Your account is currently suspended. Please contact our support team for assistance.'
         )
      }
      const unverifiedField = !user.hasEmailVerified
         ? 'email'
         : !user.hasPhoneVerified
            ? 'phone'
            : null;

      if (unverifiedField) {
         throw new ApiError(
            400,
            `Please verify ${unverifiedField} before proceeding to reserve this property.`,
         );
      }

      const resourceId = validateObjectId(req.params.resourceId);
      const property = await Property.findOne({
         _id: resourceId,
         visibility: 'published',
         status: PROPERTY_STATUS.ACTIVE,
         isBookable: true,
      }).populate({ path: 'propertyRules', select: "isHaveInstantBooking" });

      if (!property) {
         throw new ApiError(
            400,
            'No property found with the requested property ID',
         );
      }
      if (property.hostId.equals(user._id)) {
         throw new ApiError(
            400,
            'Dear user, you cannot book your own property from the main website. To block certain dates, please visit the user panel.',
         );
      }
      const checkAvailability = await property.checkAvailableDate(
         checkIn,
         checkOut,
      );
      if (!checkAvailability) {
         throw new ApiError(400, 'Sorry, no availability for this property');
      }

      await withMongoTransaction(async (session) => {
         const paymentService = new PaymentService(stripe, session, currency);
         const { newBilling, newReservation } = await paymentService.createReservation(
            property,
            user,
            resourceId,
            checkIn,
            checkOut,
            adult,
            child,
            guestDetails,
            promoCode,
         );
         paymentAttributes = await paymentService.initiatePayment(
            user,
            newReservation,
            newBilling,
            property,
            clientType,
         );
      })

      console.log('transaction commited successfully');

      const { sessionId, reservationId, url } = paymentAttributes

      return res.json(
         new ApiResponse(201, 'Payment initiated', {
            sessionId,
            reservationId,
            url,
         }),
      );
   } catch (err) {
      console.error('Transaction failed:', err);
      if (err.code === 112) {
         return res.json(
            new ApiResponse(
               409,
               'The selected dates for this property are no longer available. Please select different dates or try again.',
            ),
         );
      }
      console.log('transaction session aborted.');

      return next(err);
   }
}

export async function retrivePaymentLink(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sessionUser = req.user as ISessionUser;
   try {
      const reservationId = validateObjectId(req.params.reservationId);
      const reservation = await Reservation.findOne({
         _id: reservationId,
         userId: sessionUser._id,
         status: 'open',
      });
      if (!reservation) {
         throw new ApiError(
            404,
            'No reservation found to retrive payment session.',
         );
      }
      const transaction = await Transaction.findOne({
         reservationId,
         paymentStatus: 'open',
      });
      if (!transaction) {
         throw new ApiError(500, 'Something went wrong');
      }
      const existingSession = await stripe.checkout.sessions.retrieve(
         transaction.stripeSessionId,
      );
      if (existingSession && existingSession.status === 'open') {
         return res.json(
            new ApiResponse(
               200,
               'complete your payment for yours existing session',
               {
                  transactionId: transaction._id,
                  sessionId: existingSession.id,
                  url: existingSession.url,
               },
            ),
         );
      }

      throw new ApiError(
         400,
         `your reservation payment has been ${existingSession.status}.`,
      );
   } catch (err) {
      next(err);
   }
}



export async function handlePaymentRedirect(req, res, next) {
   const sig = req.headers?.['stripe-signature'];
   const rawBody = req.body;

   try {
      if (!sig) {
         return res.status(400).send('Missing Stripe signature');
      }

      if (!(rawBody instanceof Buffer)) {
         throw new Error('Request body must be a Buffer');
      }

      const event: Stripe.Event = Stripe.webhooks.constructEvent(
         rawBody,
         sig,
         env.ENDPOINT_SECRET!,
      );

      const eventObject = event.data.object as { metadata?: { server_url?: string; reservationId?: string } };

      if (!eventObject?.metadata) {
         console.log(`Skipping event ${event.type} - no metadata`);
         return res.json({ status: 'skipped', reason: 'no_metadata' });
      }

      const targetServerUrl = eventObject.metadata.server_url;
      const reservationId = eventObject.metadata.reservationId;

      if (!targetServerUrl) {
         console.log(`Skipping event ${event.type} - no server_url in metadata`);
         return res.json({ status: 'skipped', reason: 'no_server_url' });
      }

      const currentServerUrl = process.env.SERVER_URL;

      if (targetServerUrl !== currentServerUrl) {
         console.log(`Skipping event - target: ${targetServerUrl}, current: ${currentServerUrl}`);
         return res.json({
            status: 'skipped',
            reason: 'different_server',
            target: targetServerUrl,
            current: currentServerUrl
         });
      }

      console.log(`Processing event ${event.type} for server: ${currentServerUrl}`);

      await withMongoTransaction(async (session) => {
         if (
            event.type === 'checkout.session.completed' ||
            event.type === 'payment_intent.succeeded'
         ) {
            if (!reservationId) {
               console.log('No reservationId found in metadata');
               return;
            }

            const reservation = await Reservation.updateOne(
               { _id: reservationId, status: 'open' },
               { $set: { expiresAt: null } },
               { session: session },
            );

            if (reservation.modifiedCount == 0) {
               return;
            }
         }

         await EventLogs.findOneAndUpdate(
            { eventId: event.id },
            {
               eventId: event.id,
               lastProcessAttempt: new Date(),
               processedBy: currentServerUrl,
            },
            {
               upsert: true,
               new: true,
               session: session,
            },
         );
      });

      await schedulePaymentJob(event);
      res.json({ status: 'received' });
   } catch (err) {
      console.log(err);
      next(err);
   }
}
//replace this redundant feature in future in to one single feature current difference in the webhook secret
export async function handleConnectRedirect(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sig = req.headers['stripe-signature'];
   const rawBody = req.body;
   const session = await mongoose.startSession();
   try {
      session.startTransaction();
      if (!sig) {
         return res.status(400).send('Missing Stripe signature');
      }

      if (!(rawBody instanceof Buffer)) {
         throw new Error('Request body must be a Buffer');
      }

      const event: Stripe.Event = Stripe.webhooks.constructEvent(
         rawBody,
         sig,
         env.CONNECT_SECRET!,
      );
      const eventLog = await EventLogs.findOne({ eventId: event.id });

      if (!eventLog) {
         await EventLogs.create(
            [
               {
                  eventId: event.id,
                  lastProcessAttempt: new Date(),
                  processAttempts: 1,
               },
            ],
            { session },
         );

         await JobQueues.insertOne(
            { status: 'pending', payload: event },
            { session },
         );
      }

      res.json({ status: 'received' });

      await session.commitTransaction();
   } catch (err) {
      await session.abortTransaction();
      next(err);
   } finally {
      await session.endSession();
   }
}

export async function getFullReservationDetails(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sessionUser = req.user as ISessionUser;
   try {
      const reservationId = validateObjectId(req.params.reservationId);
      const filter = {
         _id: reservationId,
         userId: sessionUser._id,
         isSelfBooked: false,
      };
      const isReservationExists = !!(await Reservation.findOne(filter));
      if (!isReservationExists) {
         throw new ApiError(404, 'Reservation not found.');
      }

      const [reservation] = await Reservation.aggregate([
         {
            $match: filter,
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
                        thumbnail: 1,
                        location: 1,
                     },
                  },
               ],
               as: 'property',
            },
         },
         {
            $unwind: {
               path: '$property',
               preserveNullAndEmptyArrays: true,
            },
         },
         {
            $lookup: {
               from: 'billings',
               localField: '_id',
               foreignField: 'reservationId',
               as: 'billing',
            },
         },
         { $unwind: { path: '$billing', preserveNullAndEmptyArrays: true } },
         {
            $lookup: {
               from: 'transactions',
               localField: 'billing._id',
               foreignField: 'billingId',
               as: 'billing.transactions',
            },
         },
         {
            $project: {
               reservationStatus: '$status',
               reservationCode: 1,
               numberOfGuests: 1,
               property: 1,
               isInstantBooking: 1,
               hostDecision: 1,
               cancelledBy: 1,
               confirmedAt: 1,
               cancelledAt: 1,
               hostDecisionAt: 1,
               userId: 1,
               cancellationReason: 1,
               checkInDate: 1,
               checkOutDate: 1,
               numberOfGuest: 1,
               billing: 1,
               totalPrice: 1,
               createdAt: 1,
            },
         },
      ]);
      return res.json(
         new ApiResponse(200, 'Reservation Details details fetched successfully', {
            reservation,
         }),
      );
   } catch (err) {
      return next(err);
   }
}


export async function handleCancelOrderGuestSide(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { reason } = req.body;

   const user = req.user as ISessionUser;

   try {
      const reservationId = validateObjectId(req.params.reservationId);

      const filter = {
         _id: reservationId,
         status: { $in: ["awaiting_confirmation", "complete"] },
         userId: user._id
      }



      const options = {
         filter,
         userId: user._id,
         reason,
         cancelledBy: 'guest'

      }

      const response = await handleCancelOrder(options)

      return res.json(response);

   } catch (err) {
      console.error(`[handleCancelOrder] Error:`, err);
      if (err.type === 'StripeError') {
         return res.status(400).json({
            error: 'Payment processing error',
            code: err.code,
         });
      }
      return next(err);
   }
}



export async function handleHostBookingConfirmation(
   req: Request,
   res: Response,
   next: NextFunction
) {
   const user = req.user as ISessionUser
   const { reason, status } = req.body
   try {

      const reservationId = validateObjectId(req.params.reservationId)

      if (!["accepted", "rejected"].includes(status as string)) {
         throw new ApiError(400, "Please provide either accepted | rejected")
      }

      if (!reason && status === 'rejected') {
         throw new ApiError(400, ' reason for rejection is mandatory')
      }

      const now = moment.utc(new Date()).startOf('date').toDate()


      const filter = {
         _id: reservationId,
         hostId: user._id,
         // checkInDate: { $gt: now }, // future only
         status: { $in: ["awaiting_confirmation", "complete"] }
      }

      const reservation = await Reservation.findOne(filter);

      if (!reservation) {
         throw new ApiError(404, 'Reservation not found.');
      }

      if (reservation.isSelfBooked) {
         throw new ApiError(
            409,
            'This reservation was booked manually and can only be canceled from the Calendar section.'
         );
      }

      if (reservation.checkInDate < now) {
         throw new ApiError(
            409,
            'This reservation cannot be cancelled because the check-in date has already passed.'
         );
      }

      const options = {
         filter,
         userId: user._id,
         reason,
         cancelledBy: 'host'

      }
      let response;
      if (status == "rejected") {
         response = await handleCancelOrder(options)
      }
      else if (status === "accepted") {
         await Reservation.updateOne({ _id: reservationId, hostId: user._id }, {
            $set: {
               status: "complete",
               hostDecisionAt: now,
               hostDecision: 'approved',
               confirmedAt: now
            }
         })
         response = new ApiResponse(200, "Reservation status updated successfully.")
      }

      agenda.cancel({
         name: reservationDefines.AUTO_CANCEL_RESERVATION,
         'data.reservationId': String(reservation._id)
      }).catch((err) => console.log(`error cancelling us ${reservationDefines.AUTO_CANCEL_RESERVATION} job`, err))

      return res.json(response)
   }

   catch (err) {
      return next(err)
   }


}

// export async function selfBookProperty(
//    req: Request,
//    res: Response,
//    next: NextFunction,
// ) {
//    let session: ClientSession | null = null;
//    const user = req.user as ISessionUser;
//    const query: Partial<{
//       checkInDate: Date;
//       checkOutDate: Date;
//    }> = req.query;

//    try {
//       const checkInDate = moment.utc(query.checkInDate).startOf('day');
//       const checkOutDate = moment.utc(query.checkOutDate).startOf('day');
//       const { blockReason } = req.body;
//       const today = moment.utc(new Date()).startOf('day');

//       const hostUser = await User.findById(user._id).select('status')

//       if (hostUser.status === "suspended") {
//          throw new ApiError(
//             409,
//             'Your account is currently suspended. Please contact our support team for assistance.'
//          )
//       }

//       if (!checkInDate.isValid() || !checkOutDate.isValid()) {
//          throw new ApiError(400, 'Invalid date format');
//       }

//       if (checkInDate.isBefore(today)) {
//          throw new ApiError(400, 'Check-in date must be today or later');
//       }

//       if (!checkOutDate.isAfter(checkInDate)) {
//          throw new ApiError(
//             400,
//             'Check-out date must be at least 1 day after check-in',
//          );
//       }

//       const propertyId = validateObjectId(req.params.propertyId);

//       session = await mongoose.startSession();

//       await session.withTransaction(async () => {
//          const property = await Property.findOne({
//             _id: propertyId,
//             hostId: user._id,
//             visibility: 'published',
//          }).session(session);

//          if (!property) {
//             throw new ApiError(404, 'Property not found.');
//          }

//          const isDatesAvailable = await property.checkAvailableDate(
//             checkInDate.toDate(),
//             checkOutDate.toDate(),
//          );

//          if (!isDatesAvailable) {
//             throw new ApiError(
//                208,
//                'These dates cannot be used for self-booking as they are currently in use.',
//             );
//          }

//          const reservationPayload = {
//             hostId: user._id,
//             userId: user._id,
//             checkInDate: checkInDate.toDate(),
//             checkOutDate: checkOutDate.toDate(),
//             propertyId,
//             isSelfBooked: true,
//             status: 'complete',
//             expiresAt: null,
//          };

//          if (blockReason) {
//             reservationPayload['blockReason'] = blockReason;
//          }
//          await Reservation.create([reservationPayload], { session });
//       });

//       res.status(201).json(
//          new ApiResponse(
//             201,
//             'Reservation successfully blocked for the provided dates.',
//          ),
//       );
//    } catch (err) {
//       console.error(
//          `[selfBookProperty] Error for user ${req.user?.['_id']}:`,
//          err,
//       );
//       next(err); // Error middleware handles the response
//    } finally {
//       if (session) {
//          await session.endSession(); // Clean up session
//       }
//    }
// }

// export async function getSelfAndGuestBlocksByPropertyId(
//    req: Request,
//    res: Response,
//    next: NextFunction,
// ) {
//    const user = req.user as ISessionUser;
//    try {
//       const propertyId = validateObjectId(req.params.propertyId);
//       const todayDate = moment.utc(new Date()).startOf('day').toDate();
//       const filter = {
//          hostId: user._id,
//          propertyId,
//          // checkOutDate: { $gte: todayDate },
//       };
//       const property = await Property.findOne({
//          _id: propertyId,
//          hostId: user._id,
//          visibility: 'published',
//       }).populate<{ price: IPricing }>('price', 'dailyRates basePrice')

//          ;
//       if (!property) {
//          throw new ApiError(
//             404,
//             'No property found with provided property id.',
//          );
//       }

//       const endDate = moment
//          .utc(todayDate)
//          .startOf('day')
//          .add(property.availabilityWindow, 'months')
//          .toDate();

//       const [dates] = await Reservation.aggregate([
//          {
//             $match: filter,
//          },
//          {
//             $lookup: {
//                from: 'users',
//                localField: 'userId',
//                foreignField: '_id',
//                as: 'userDetails',
//             },
//          },
//          {
//             $unwind: {
//                path: '$userDetails',
//                preserveNullAndEmptyArrays: true,
//             },
//          },
//          {
//             $lookup: {
//                from: 'billings',
//                localField: '_id',
//                foreignField: 'reservationId',
//                as: 'billing',
//             },
//          },

//          {
//             $unwind: {
//                path: '$billing',
//                preserveNullAndEmptyArrays: true,
//             },
//          },
//          {
//             $facet: {
//                selfBlockedDate: [
//                   { $match: { isSelfBooked: true } },
//                   {
//                      $project: {
//                         _id: 0,
//                         startDate: '$checkInDate',
//                         endDate: '$checkOutDate',
//                         status: 1,
//                         reservationCode: 1,
//                         blockReason: 1,
//                         reservationId: '$_id',
//                      },
//                   },
//                   { $sort: { endDate: 1, status: 1 } },
//                ],
//                guestBlockDate: [
//                   {
//                      $match: {
//                         isSelfBooked: false,
//                         status: { $nin: ['cancelled'] },
//                      },
//                   },
//                   {
//                      $project: {
//                         _id: 0,
//                         startDate: '$checkInDate',
//                         endDate: '$checkOutDate',
//                         billing: 1,
//                         status: 1,
//                         reservationCode: 1,
//                         reservationId: '$_id',

//                         'userDetails.firstName': 1,
//                         'userDetails.lastName': 1,
//                         'userDetails.email': 1,
//                         'userDetails.phone': 1,
//                      },
//                   },
//                   { $sort: { endDate: 1, status: 1 } },
//                ],
//             },
//          },
//       ]);

//       res.status(200).json(
//          new ApiResponse(
//             200,
//             'Self block and guest block dates fetched successfully',
//             {
//                ...dates,
//                propertyAvailabilityWindow: {
//                   startDate: todayDate,
//                   endDate,
//                },
//                basePrice: property?.price?.basePrice,
//                dailyPriceRates: property?.price?.dailyRates
//             },
//          ),
//       );
//    } catch (err) {
//       next(err);
//    }
// }
// export async function unblockSelfBlockedDates(
//    req: Request,
//    res: Response,
//    next: NextFunction,
// ) {
//    const user = req.user as ISessionUser;

//    try {

//       const reservationId = validateObjectId(req.params.reservationId);
//       const hostUser = await User.findById(user._id).select('status')

//       if (hostUser.status === "suspended") {
//          throw new ApiError(
//             409,
//             'Your account is currently suspended. Please contact our support team for assistance.'
//          )
//       }

//       const reservation = await Reservation.findOne({
//          _id: reservationId,
//          userId: user._id,
//       });

//       if (!reservation) {
//          throw new ApiError(
//             404,
//             'No self-reservation found to unblock. Please ensure you are providing the correct reservationId.',
//          );
//       }
//       await reservation.deleteOne();



//       return res.json(
//          new ApiResponse(
//             200,
//             'The blocked dates have been successfully released and are now available for booking on the main website.',
//          ),
//       );
//    } catch (err) {
//       console.error(`User ${user?._id} failed to unblock reservation:`, err);
//       next(err);
//    }
// }

// export async function updateSelfBlockedDates(
//    req: Request,
//    res: Response,
//    next: NextFunction,
// ) {
//    let session: ClientSession | null = null;

//    const user = req.user as ISessionUser;

//    try {


//       const { blockReason } = req.body;
//       const query: Partial<{
//          checkInDate: Date;
//          checkOutDate: Date;
//       }> = req.query;

//       let checkInDate = moment.utc(query.checkInDate).startOf('day');
//       const checkOutDate = moment.utc(query.checkOutDate).startOf('day');
//       const today = moment.utc(new Date()).startOf('day');

//       const hostUser = await User.findById(user._id).select('status')

//       if (hostUser.status === "suspended") {
//          throw new ApiError(
//             409,
//             'Your account is currently suspended. Please contact our support team for assistance.'
//          )
//       }
//       if (!checkInDate.isValid() || !checkOutDate.isValid()) {
//          throw new ApiError(400, 'Invalid date format');
//       }

//       if (
//          !checkOutDate.isAfter(checkInDate) &&
//          !checkOutDate.isSameOrAfter(today)
//       ) {
//          throw new ApiError(
//             400,
//             'Check-out date must be at least 1 day after check-in and 1 day after or same as todays date',
//          );
//       }

//       const reservationId = validateObjectId(req.params.reservationId);
//       session = await mongoose.startSession();

//       await session.withTransaction(async () => {
//          const reservation = await Reservation.findOne({
//             userId: user._id,
//             _id: reservationId,
//          }).session(session);

//          if (!reservation) {
//             throw new ApiError(404, 'No self-reservation found to update.');
//          }

//          const prevCheckIn = moment.utc(reservation.checkInDate).startOf('day');
//          const prevCheckOut = moment
//             .utc(reservation.checkOutDate)
//             .startOf('day');

//          const isDateChanged =
//             !prevCheckIn.isSame(checkInDate) ||
//             !prevCheckOut.isSame(checkOutDate);

//          if (prevCheckIn.isBefore(today)) {
//             //if db checkin date is before today date just accept and ignore that upcoming checkinDate re assign back to db checkin date and flow silently
//             checkInDate = prevCheckIn;
//          }
//          if (isDateChanged) {
//             const isAvailable = await checkAvailableDatesForHost(
//                checkInDate.toDate(),
//                checkOutDate.toDate(),
//                reservation.propertyId,
//                reservation._id,
//             );

//             if (!isAvailable) {
//                throw new ApiError(
//                   400,
//                   'These dates cannot be used for self-booking as they are already in use.',
//                );
//             }

//             reservation.checkInDate = checkInDate.toDate();
//             reservation.checkOutDate = checkOutDate.toDate();
//          }

//          if (blockReason) {
//             reservation.blockReason = blockReason;
//          }

//          await reservation.save({ session });
//       });

//       res.status(200).json(
//          new ApiResponse(
//             200,
//             'The blocked dates have been successfully updated.',
//          ),
//       );
//    } catch (err) {
//       console.error(
//          `[updateSelfBlockedDates] Error for user ${user._id}:`,
//          err,
//       );
//       next(err);
//    } finally {
//       if (session) await session.endSession();
//    }
// }

export async function getHostEntireReservationsDetailsById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sessionUser = req.user as ISessionUser;
   const filter: Record<string, unknown> = { hostId: sessionUser._id };
   try {
      const reservationId = validateObjectId(req.params.reservationId);
      const reservation = await Reservation.findOne({
         _id: reservationId,
         hostId: sessionUser._id,
      });

      if (!reservation) {
         throw new ApiError(
            404,
            'No reservation found for requested reservation id',
         );
      }
      filter._id = reservationId;
      const result =
         await commonReservationUtils.getEntireReservationDetailsById(filter);
      res.json(result);
   } catch (err) {
      next(err);
   }
}

export async function getHostReservationsByFilter(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const pageAttr = res.locals.pagination;
   const sessionUser = req.user as ISessionUser;
   const filter: Record<string, unknown> = {};
   try {
      let propertyId: string | mongoose.Types.ObjectId = req.params.propertyId;
      if (propertyId) {
         propertyId = validateObjectId(propertyId);
         filter.propertyId = propertyId;
      }
      filter.hostId = sessionUser._id;
      // filter.propertyStatus = { $ne: PROPERTY_STATUS.DELETED }

      const [result, propertyDetails] = await Promise.all([
         getFilteredReservations(pageAttr, req.query, filter),
         propertyId
            ? Property.findOne({
               _id: propertyId,
               hostId: sessionUser._id,
            }).select('title')
            : null,
      ]);

      return res.json({
         ...result,
         propertyDetails,
      });
   } catch (err) {
      next(err);
   }
}

export async function getAllHostTransactions(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { pagination, search, sort } = res.locals;
   const { sortDirection, sortField } = sort;
   const { searchTerm } = search;

   const sessionUser = req.user as ISessionUser;

   // Base filter
   const filter = {
      hostId: sessionUser._id,
      status: 'complete',
      isSelfBooked: false,
   };

   // Search filters
   const searchFilters: Record<string, unknown> = {};
   if (searchTerm) {
      const regex = { $regex: searchTerm, $options: 'i' };
      const fieldsToSearch = [
         'propertyDetails.title',
         'reservationCode',
         'transaction.paymentAmount',
      ];
      searchFilters.$or = fieldsToSearch.map((field) => ({ [field]: regex }));
   }

   const sortMap: Record<string, string> = {
      createdAt: 'createdAt',
      paymentAmount: 'paymentAmount',
      paymentDate: 'paymentDate',
   };

   let sortFilter: Record<string, 1 | -1> = { createdAt: -1 };
   if (sortField && sortMap[sortField]) {
      sortFilter = { [sortMap[sortField]]: sortDirection };
   }

   try {
      const pipeline = [
         { $match: filter },
         {
            $lookup: {
               from: 'transactions',
               localField: '_id',
               foreignField: 'reservationId',
               as: 'transaction',
            },
         },
         { $unwind: '$transaction' },
         {
            $lookup: {
               from: 'properties',
               localField: 'propertyId',
               foreignField: '_id',
               pipeline: [{ $project: { title: 1 } }],
               as: 'propertyDetails',
            },
         },
         { $unwind: { path: '$propertyDetails', preserveNullAndEmptyArrays: true } },
         ...(Object.keys(searchFilters).length ? [{ $match: searchFilters }] : []),
         {
            $project: {
               _id: 0,
               reservationId: '$_id',
               reservationCode: 1,
               propertyDetails: 1,
               paymentAmount: '$transaction.paymentAmount',
               paymentDate: '$transaction.createdAt',
               createdAt: 1,
            },
         },
      ];

      const reservationsPromise = Reservation.aggregate([
         ...pipeline,
         { $sort: sortFilter },
         { $skip: pagination.startIndex },
         { $limit: pagination.limit },
      ]);

      const countPromise = Reservation.aggregate([
         ...pipeline,
         { $count: 'total' },
      ]).then((res) => (res[0]?.total || 0));

      const [reservations, countReservations] = await Promise.all([
         reservationsPromise,
         countPromise,
      ]);
      const result = formatPaginationResponse(
         reservations,
         countReservations,
         pagination,
      );
      res.json(result);
   } catch (err) {
      next(err);
   }
}
