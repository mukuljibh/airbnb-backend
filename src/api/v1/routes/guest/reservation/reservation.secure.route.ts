import express from 'express';
import * as generalReservationController from '../../../controllers/general/reservation/reservation.controller';
import * as reviewController from '../../../controllers/general/reservation/review.controller'
import { validateReservationPayment } from '../../../validation/general/reservation/general.reservation.validation';
import { fetchInvoice } from '../../../controllers/general/reservation/invoice.controller';
import * as commonReservationValidation from '../../../validation/common/reservation/common.reservation.validation';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Payment Routes (most specific first to avoid collision)
|--------------------------------------------------------------------------
*/
router.post(
   '/:resourceId/pay',
   validateReservationPayment,
   generalReservationController.intiateReservationPayments,
);

router.get(
   '/:reservationId/retrieve-payment-link',
   generalReservationController.retrivePaymentLink,
);

/* 
|--------------------------------------------------------------------------
| Review Routes
|--------------------------------------------------------------------------
*/
router.post(
   '/:reservationId/reviews',
   reviewController.postReviewById
);

router.patch(
   '/:reservationId/reviews',
   reviewController.updateReviewById
);

// router.delete(
//    '/:reservationId/reviews',
//    reviewController.deleteReviewById,
// );

/* 
|--------------------------------------------------------------------------
| Invoice Route
|--------------------------------------------------------------------------
*/
router.get(
   '/invoice/:reservationId',
   fetchInvoice
);

/* 
|--------------------------------------------------------------------------
| Reservation Management Routes
|--------------------------------------------------------------------------
*/
router.post(
   '/:reservationId/cancel',
   generalReservationController.handleCancelOrderGuestSide,
);

/* 
|--------------------------------------------------------------------------
| Single Reservation Details
|--------------------------------------------------------------------------
*/
router.get(
   '/:reservationId/details',
   generalReservationController.getFullReservationDetails,
);

/* 
|--------------------------------------------------------------------------
| Get All Reservations (must be last to avoid collisions)
|--------------------------------------------------------------------------
*/
router.get(
   '/',
   commonReservationValidation.validateGetAllReservations('guest'),
   generalReservationController.getAllUserReservation,
);

export default router;
