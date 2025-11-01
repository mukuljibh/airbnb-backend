import express from 'express';
import * as adminReservationController from '../../../controllers/admin/reservation/reservation.controller';
import * as commonReservationValidation from '../../../validation/common/reservation/common.reservation.validation';
import * as adminReservationValidation from '../../../validation/admin/reservation/admin.reservation.validation';

const router = express.Router();

/* 
|-------------------------------------------------------------------
| Fetch Host Properties & Reservations
|-------------------------------------------------------------------
| This route retrieves a specific host property along with all its reservations.
| - `propertyId` is required and validated.
| - `createPages` middleware is used for pagination.
|
*/

router.get(
   '/host-properties/:propertyId',
   commonReservationValidation.validateGetAllReservations('admin'),
   adminReservationController.getReservationsByFilterForAdmin,
);

router.get(
   '/all-reservations',
   commonReservationValidation.validateGetAllReservations('admin'),
   adminReservationController.getReservationsByFilterForAdmin,
);

router.get(
   '/all-transactions',
   adminReservationValidation.validateGetAllTransations,
   adminReservationController.getAllTransactions,
);

router.get(
   '/:reservationId',
   adminReservationController.getEntireReservationsPaymentDetailsById,
);

export default router;
