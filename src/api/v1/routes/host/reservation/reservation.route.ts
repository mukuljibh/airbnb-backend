import express from 'express';
import * as generalReservationController from '../../../controllers/general/reservation/reservation.controller';
import * as commonReservationValidation from '../../../validation/common/reservation/common.reservation.validation';

const router = express.Router();

/* 
|-------------------------------------------------------------------------- 
| Host property block dates Routes 
|-------------------------------------------------------------------------- 
| - Fetch host property block dates + guest block dates for a specific property owned by a host. 
| - delete and blocking self block dates.
| 
*/

// router.get(
//    '/block-availablity/:propertyId',
//    generalReservationController.getSelfAndGuestBlocksByPropertyId,
// );
// router.delete(
//    '/block-availablity/:reservationId',
//    generalReservationController.unblockSelfBlockedDates,
// );
// router.patch(
//    '/block-availablity/:reservationId',
//    generalReservationController.updateSelfBlockedDates,
// );

// router.post(
//    '/block-availablity/:propertyId',
//    generalReservationController.selfBookProperty,
// );

/* 
|-------------------------------------------------------------------------- 
| Host Reservation Routes 
|-------------------------------------------------------------------------- 
| - Fetch reservations for a specific property owned by a host. 
| - Supports pagination for performance. 
*/
router.get(
   '/host-properties/:propertyId',
   commonReservationValidation.validateGetAllReservations('host'),
   generalReservationController.getHostReservationsByFilter,
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
   commonReservationValidation.validateGetAllReservations('host'),
   generalReservationController.getAllUserReservation,
);


router.get(
   '/all-reservations',
   commonReservationValidation.validateGetAllReservations('host'),
   generalReservationController.getHostReservationsByFilter,
);

router.get(
   '/all-transactions',
   generalReservationController.getAllHostTransactions,
);


router.get(
   '/:reservationId',
   generalReservationController.getHostEntireReservationsDetailsById,
);



/* 
|-------------------------------------------------------------------------- 
| Reservation Management Routes 
|-------------------------------------------------------------------------- 
| - Handles reservation cancellation. 
*/

//for host only for confirming booking 
router.patch(
   '/:reservationId/status',
   generalReservationController.handleHostBookingConfirmation,
);



export default router;
