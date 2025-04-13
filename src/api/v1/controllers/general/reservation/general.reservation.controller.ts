import { Request, Response, NextFunction } from 'express';
import { Reservation } from '../../../models/reservation/reservation';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import Stripe from 'stripe';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { PaymentService } from './utils/general.reservation.payments.helper';
import { Transaction } from '../../../models/reservation/transaction';
import mongoose from 'mongoose';
import { Property } from '../../../models/property/property';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { EventLogs } from '../../../models/reservation/eventLogs';
import { User } from '../../../models/user/user';
import moment from 'moment';
import { checkAvailableDate } from '../properties/utils/general.property.utils';
import { format } from 'date-fns';
import { JobQueues } from '../../../models/jobQueues';
import { reservationEmitter } from '../../../events/reservation/reservation.emitter';
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
   apiVersion: '2025-02-24.acacia', // Use the latest API version
});

export async function getAllUserReservation(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const pagesAttr = res.locals.pagination;
   const user = req.user as ISessionUser;
   const status = req.query?.status;
   let statusMatchStage = {};
   if (status !== 'all') {
      if (status === 'complete') {
         statusMatchStage = { status: { $in: ['complete', 'processing'] } };
      } else {
         statusMatchStage = { status };
      }
   }

   // 'open', 'complete', 'processing', 'cancelled'
   try {
      if (
         !['complete', 'cancelled', 'open', 'all'].includes(status as string)
      ) {
         throw new ApiError(
            400,
            'this are valid status complete | cancelled | open | all ',
         );
      }

      const results = await Reservation.aggregate([
         {
            $match: {
               userId: user._id,
               isSelfBooked: false,
               ...statusMatchStage,
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
            $addFields: {
               sortOrder: {
                  $switch: {
                     branches: [
                        { case: { $eq: ['$status', 'open'] }, then: 1 },
                        { case: { $eq: ['$status', 'complete'] }, then: 2 },
                        { case: { $eq: ['$status', 'processing'] }, then: 2 },

                        { case: { $eq: ['$status', 'cancelled'] }, then: 3 },
                     ],
                     default: 4,
                  },
               },
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
               checkInDate: 1,
               checkOutDate: 1,

               createdAt: 1,
               sortOrder: 1,
            },
         },

         { $sort: { sortOrder: 1, createdAt: -1 } },
         { $skip: pagesAttr.startIndex },
         { $limit: pagesAttr.limit },
      ]);
      const totalCount = await Reservation.countDocuments({
         userId: user._id,
         isSelfBooked: false,
         ...statusMatchStage,
      });
      const result = formatPaginationResponse(results, totalCount, pagesAttr);
      res.status(200).json(result);
   } catch (err) {
      next(err);
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
   const query: Partial<{
      checkIn: Date;
      checkOut: Date;
      child: number;
      adult: number;
      promoCode?: string;
   }> = req.query;
   const clientType = req.headers['client-type'] as 'Mobile' | undefined;
   const checkIn = query.checkIn as Date;
   const checkOut = query.checkOut as Date;
   const adult = query.adult;
   const child = query.child;
   const sessionUser = req.user as ISessionUser;

   const session = await mongoose.startSession();
   try {
      session.startTransaction();
      const user = await User.findById(sessionUser._id);
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
      });
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

      if (!(await property.checkAvailableDate(checkIn, checkOut))) {
         throw new ApiError(400, 'Sorry, no availability for this property');
      }

      const paymentService = new PaymentService(stripe, session);
      const newReservation = await paymentService.createReservation(
         user,
         resourceId,
         checkIn,
         checkOut,
         adult,
         child,
         query.promoCode,
      );
      const { sessionId, reservationId, url } =
         await paymentService.initiatePayment(
            user,
            newReservation._id,
            clientType,
         );
      await session.commitTransaction();
      console.log('transaction commited successfully');
      res.status(201).json(
         new ApiResponse(201, 'Payment initiated', {
            sessionId,
            reservationId,
            url,
         }),
      );
   } catch (err) {
      console.error('Transaction failed:', err);
      if (err.code === 112) {
         return res
            .status(409)
            .json(
               new ApiResponse(
                  409,
                  'The selected dates for this property are no longer available. Please select different dates or try again.',
                  null,
               ),
            );
      }
      await session.abortTransaction();
      console.log('transaction session aborted.');

      next(err);
   } finally {
      console.log('transaction session closed successfully');
      await session.endSession();
   }
}

export async function retrivePaymentLink(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const reservationId = validateObjectId(req.params.reservationId);
      const transaction = await Transaction.findOne({
         reservationId,
         paymentStatus: 'processing',
      });
      if (!transaction) {
         throw new ApiError(500, 'Something went wrong');
      }
      const existingSession = await stripe.checkout.sessions.retrieve(
         transaction.stripeSessionId,
      );
      if (existingSession && existingSession.status === 'open') {
         res.status(200).json(
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

         return;
      }

      throw new ApiError(
         400,
         `your reservation payment has been ${existingSession.status}.`,
      );
   } catch (err) {
      next(err);
   }
}

export async function handlePaymentRedirect(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const sig = req.headers['stripe-signature'];
   const rawBody = req.body;
   const session = await mongoose.startSession();
   let job;
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
         process.env.ENDPOINT_SECRET!,
      );
      console.log(event.type);

      // Instead of separate find + update operations, do it in one atomic operation
      const result = await EventLogs.findOneAndUpdate(
         { eventId: event.id },
         {
            eventId: event.id,
            lastProcessAttempt: new Date(),
         },
         {
            upsert: true,
            new: true,
            session: session, // Pass session directly in options object
         },
      );

      // If this is the first attempt (processAttempts === 1), create the job
      if (result.processAttempts === 0) {
         job = new JobQueues({
            status: 'pending',
            payload: event,
            processingAt: new Date(),
         });
         await job.save({ session });
         //mark reservation expired at null so that ttl will stop on reservation document
         const reservationId =
            job?.payload?.data?.object?.metadata?.reservationId;
         await Reservation.findOneAndUpdate(
            { _id: reservationId },
            { $set: { expiresAt: null } },
         ).session(session);
      }

      res.json({ status: 'received' });
      await session.commitTransaction();
      // reservationEmitter.emit('reservation:updatePayment', job);
   } catch (err) {
      await session.abortTransaction();
      next(err);
   } finally {
      await session.endSession();
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
         process.env.CONNECT_SECRET!,
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
   try {
      const reservationId = validateObjectId(req.params.reservationId);
      const isReservationExists = !!(await Reservation.findOne({
         _id: reservationId,
         isSelfBooked: false,
      }));
      if (!isReservationExists) {
         throw new ApiError(404, 'Reservation not found.');
      }

      const [reservation] = await Reservation.aggregate([
         {
            $match: {
               _id: reservationId,
               isSelfBooked: false,
            },
         },
         {
            $lookup: {
               from: 'users',
               localField: 'userId',
               foreignField: '_id',
               pipeline: [
                  {
                     $project: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        phone: 1,
                     },
                  },
               ],
               as: 'guestDetails',
            },
         },
         {
            $unwind: {
               path: '$guestDetails',
               preserveNullAndEmptyArrays: true,
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
               userId: 1,
               checkInDate: 1,
               checkOutDate: 1,
               numberOfGuest: 1,
               billing: 1,
               guestDetails: '$guestDetails',
            },
         },
      ]);
      res.status(200).json(
         new ApiResponse(200, 'bookingDetails details fetched successfully', {
            reservation,
         }),
      );
   } catch (err) {
      next(err);
   }
}

// Cancel order and handle refund flow

export async function handleCancelOrder(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { reason } = req.body;
   const user = req.user as ISessionUser;
   try {
      const reservationId = validateObjectId(req.params.reservationId);
      const reservation = await Reservation.findOneAndUpdate(
         { _id: reservationId },
         { status: 'processing' },
      );
      if (!reservation) {
         throw new ApiError(400, 'No reservation found to cancel');
      }
      const transactions = await Transaction.find({
         reservationId: reservationId,
         type: 'PAYMENT',
      });
      if (!transactions) {
         throw new ApiError(400, 'no transactions found to cancel');
      }
      const property = await Property.findById(reservation.propertyId);

      const guestUser = await User.findById(user._id);
      const refunds = await Promise.all(
         transactions.map(async (transaction) => {
            const refund = await stripe.refunds.create({
               payment_intent: transaction.paymentIntentId,
               reason: 'requested_by_customer',
               metadata: {
                  billingId: transaction.billingId.toString(),
                  reservationId: transaction.reservationId.toString(),
                  referenceTxn: transaction._id.toString(),
                  refundAmount: transaction.paymentAmount,
                  thumbnail: property?.thumbnail,
                  checkInDate: String(
                     format(reservation.checkInDate, 'MMMM dd, yyyy'),
                  ),
                  checkOutDate: String(
                     format(reservation.checkOutDate, 'MMMM dd, yyyy'),
                  ),
                  guestEmail: guestUser?.email,
                  guestName: ` ${guestUser.firstName} ${guestUser.lastName}`,
                  propertyAddress: property.location.address,
                  propertyTitle: property?.title,
                  reservationCode: reservation?.reservationCode,
                  cancellationReason: reason,
               },
            });

            return refund;
         }),
      );

      res.status(200).json(
         new ApiResponse(200, 'Refund Intiated Successfully.', {
            refunds,
         }),
      );
   } catch (err) {
      // Handle Stripe errors specifically
      if (err.type === 'StripeError') {
         return res.status(400).json({
            error: 'Payment processing error',
            code: err.code,
         });
      }
      next(err);
   }
}

export async function selfBookProperty(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const user = req.user as ISessionUser;
      const query: Partial<{
         checkInDate: Date;
         checkOutDate: Date;
      }> = req.query;

      const checkInDate = moment.utc(query.checkInDate).startOf('day');
      const checkOutDate = moment.utc(query.checkOutDate).startOf('day');
      const { blockReason } = req.body;
      const today = moment.utc(new Date()).startOf('day');
      if (!checkInDate.isValid() || !checkOutDate.isValid()) {
         throw new Error('Invalid date format');
      }

      if (checkInDate.isBefore(today)) {
         throw new Error('Check-in date must be today or later');
      }

      if (!checkOutDate.isAfter(checkInDate)) {
         throw new Error(
            'Check-out date must be at least 1 day after check-in',
         );
      }
      const propertyId = validateObjectId(req.params.propertyId);

      const property = await Property.findOne({
         _id: propertyId,
         hostId: user._id,
         visibility: 'published',
      });
      if (!property) {
         throw new ApiError(404, 'Property not found.');
      }

      const isDatesAvailable = await property.checkAvailableDate(
         checkInDate.toDate(),
         checkOutDate.toDate(),
      );
      if (!isDatesAvailable) {
         return res
            .status(208)
            .json(
               new ApiResponse(
                  208,
                  'This dates can not be used for self booking as it currently been used.',
               ),
            );
      }
      const reservationPayload = {
         hostId: user._id,
         userId: user._id,
         checkInDate: checkInDate.toDate(),
         checkOutDate: checkOutDate.toDate(),
         propertyId,
         isSelfBooked: true,
         status: 'complete',
         expiresAt: null,
      };
      if (blockReason) {
         reservationPayload['blockReason'] = blockReason;
      }
      await Reservation.create(reservationPayload);
      res.status(201).json(
         new ApiResponse(
            201,
            'Reservation successfully blocked for provided mention dates',
         ),
      );
   } catch (err) {
      next(err);
   }
}

export async function getSelfAndGuestBlocksByPropertyId(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const propertyId = validateObjectId(req.params.propertyId);
      const todayDate = moment.utc(new Date()).startOf('day').toDate();
      const filter = {
         hostId: user._id,
         propertyId,
         // checkOutDate: { $gte: todayDate },
      };
      const property = await Property.findOne({
         _id: propertyId,
         hostId: user._id,
         visibility: 'published',
      });
      if (!property) {
         throw new ApiError(
            404,
            'No property found with provided property id.',
         );
      }
      const endDate = moment
         .utc(todayDate)
         .startOf('day')
         .add(property.availabilityWindow, 'months')
         .toDate();

      const [dates] = await Reservation.aggregate([
         {
            $match: filter,
         },
         {
            $lookup: {
               from: 'users',
               localField: 'userId',
               foreignField: '_id',
               as: 'userDetails',
            },
         },
         {
            $unwind: {
               path: '$userDetails',
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

         {
            $unwind: {
               path: '$billing',
               preserveNullAndEmptyArrays: true,
            },
         },
         {
            $facet: {
               selfBlockedDate: [
                  { $match: { isSelfBooked: true } },
                  {
                     $project: {
                        _id: 0,
                        startDate: '$checkInDate',
                        endDate: '$checkOutDate',
                        status: 1,
                        reservationCode: 1,
                        blockReason: 1,
                        reservationId: '$_id',
                     },
                  },
                  { $sort: { endDate: 1, status: 1 } },
               ],
               guestBlockDate: [
                  {
                     $match: {
                        isSelfBooked: false,
                        status: { $nin: ['cancelled'] },
                     },
                  },
                  {
                     $project: {
                        _id: 0,
                        startDate: '$checkInDate',
                        endDate: '$checkOutDate',
                        billing: 1,
                        status: 1,
                        reservationCode: 1,
                        reservationId: '$_id',

                        'userDetails.firstName': 1,
                        'userDetails.lastName': 1,
                        'userDetails.email': 1,
                        'userDetails.phone': 1,
                     },
                  },
                  { $sort: { endDate: 1, status: 1 } },
               ],
            },
         },
      ]);

      res.status(200).json(
         new ApiResponse(
            200,
            'Self block and guest block dates fetched successfully',
            {
               ...dates,
               propertyAvailabilityWindow: {
                  startDate: todayDate,
                  endDate,
               },
            },
         ),
      );
   } catch (err) {
      next(err);
   }
}
export async function unblockSelfBlockedDates(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const session = await mongoose.startSession();
   const user = req.user as ISessionUser;

   try {
      session.startTransaction();

      const reservationId = validateObjectId(req.params.reservationId);
      const reservation = await Reservation.findOne({
         _id: reservationId,
         userId: user._id,
      }).session(session);

      if (!reservation) {
         throw new ApiError(
            404,
            'No self-reservation found to unblock. Please ensure you are providing the correct reservationId.',
         );
      }

      await reservation.deleteOne({ session });

      await session.commitTransaction();

      res.status(200).json(
         new ApiResponse(
            200,
            'The blocked dates have been successfully released and are now available for booking on the main website.',
         ),
      );
      return;
   } catch (err) {
      await session.abortTransaction();
      console.error(`Error releasing dates:`, err);
      next(err);
   } finally {
      await session.endSession();
   }
}

export async function updateSelfBlockedDates(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   const query: Partial<{
      checkInDate: Date;
      checkOutDate: Date;
   }> = req.query;
   const session = await mongoose.startSession();
   const { blockReason } = req.body;
   try {
      session.startTransaction();

      const checkInDate = moment.utc(query.checkInDate).startOf('day');
      const checkOutDate = moment.utc(query.checkOutDate).startOf('day');
      const today = moment.utc(new Date()).startOf('day');

      if (!checkInDate.isValid() || !checkOutDate.isValid()) {
         throw new Error('Invalid date format');
      }

      if (checkInDate.isBefore(today)) {
         throw new Error('Check-in date must be today or later');
      }

      if (!checkOutDate.isAfter(checkInDate)) {
         throw new Error(
            'Check-out date must be at least 1 day after check-in',
         );
      }

      const reservationId = validateObjectId(req.params.reservationId);
      const reservation = await Reservation.findOne({
         userId: user._id,
         _id: reservationId,
      }).session(session);

      if (!reservation) {
         throw new ApiError(404, 'No self-reservation found to update.');
      }
      const prevCheckIn = moment.utc(reservation.checkInDate).startOf('day');
      const prevCheckOut = moment.utc(reservation.checkOutDate).startOf('day');
      if (
         !prevCheckIn.isSame(checkInDate) ||
         !prevCheckOut.isSame(checkOutDate)
      ) {
         const isDatesAvailable = await checkAvailableDate(
            checkInDate.toDate(),
            checkOutDate.toDate(),
            reservation.propertyId,
            reservation._id,
         );
         if (!isDatesAvailable) {
            throw new ApiError(
               400,
               'This dates can not be used for self booking as it currently been used.',
            );
         }
      }
      reservation.checkInDate = checkInDate.toDate();
      reservation.checkOutDate = checkOutDate.toDate();
      if (blockReason) reservation.blockReason = blockReason;
      await reservation.save({ session });
      await session.commitTransaction();

      res.status(200).json(
         new ApiResponse(
            200,
            'The blocked dates have been successfully updated.',
         ),
      );
   } catch (err) {
      await session.abortTransaction();
      next(err);
   } finally {
      await session.endSession();
   }
}
