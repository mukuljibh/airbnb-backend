import express from 'express';
import createPages from '../../../middleware/pagination/createPages';
import * as generalReservationController from '../../../controllers/general/reservation/general.reservation.controller';
import * as commonReservationControllerCommon from '../../../controllers/common/reservation/common.reservation.controller';
import { validateReservationPayment } from '../../../validation/general/reservation/general.reservation.validation';
import { fetchInvoice } from '../../../controllers/general/reservation/utils/invoice';

const router = express.Router();

/* 
|-------------------------------------------------------------------------- 
| Host property block dates Routes 
|-------------------------------------------------------------------------- 
| - Fetch host property block dates + guest block dates for a specific property owned by a host. 
| - delete and blocking self block dates.
| 
*/
router.get(
   '/block-availablity/:propertyId',
   generalReservationController.getSelfAndGuestBlocksByPropertyId,
);
router.delete(
   '/block-availablity/:reservationId',
   generalReservationController.unblockSelfBlockedDates,
);
router.patch(
   '/block-availablity/:reservationId',
   generalReservationController.updateSelfBlockedDates,
);

router.post(
   '/block-availablity/:propertyId',
   generalReservationController.selfBookProperty,
);

/* 
|-------------------------------------------------------------------------- 
| Host Reservation Routes 
|-------------------------------------------------------------------------- 
| - Fetch reservations for a specific property owned by a host. 
| - Supports pagination for performance. 
*/
router.get(
   '/host-properties/:propertyId',
   createPages,
   commonReservationControllerCommon.getHostPropertiesWithReservations,
);

/* 
|-------------------------------------------------------------------------- 
| User Reservation Routes 
|-------------------------------------------------------------------------- 
| - Fetch all reservations for a user with pagination. 
| - Retrieve details of a specific reservation. 
*/
router.get(
   '/',
   createPages,
   generalReservationController.getAllUserReservation,
);

router.get(
   '/past-reservations',
   createPages,
   generalReservationController.getPastReservations,
);

router.get(
   '/:reservationId/details',
   generalReservationController.getFullReservationDetails,
);

/* 
|-------------------------------------------------------------------------- 
| Payment Routes 
|-------------------------------------------------------------------------- 
| - Initiate reservation payment processing. 
| - Retrieve an active payment link for a reservation. 
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
router.get('/invoice/:reservationId', fetchInvoice);

/* 
|-------------------------------------------------------------------------- 
| Reservation Management Routes 
|-------------------------------------------------------------------------- 
| - Handles reservation cancellation. 
*/
router.post(
   '/:reservationId/cancel',
   generalReservationController.handleCancelOrder,
);

export default router;
