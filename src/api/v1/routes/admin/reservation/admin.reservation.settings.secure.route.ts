import express from 'express';
import * as commonReservationController from '../../../controllers/common/reservation/common.reservation.controller';
import * as adminReservationController from '../../../controllers/admin/reservation/admin.reservation.controller';
import createPages from '../../../middleware/pagination/createPages';

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
   createPages,
   commonReservationController.getHostPropertiesWithReservations,
);

router.get('/', createPages, adminReservationController.getAllUserReservation);

export default router;
