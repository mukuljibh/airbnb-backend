import express from 'express';
import generalUserPublicRoutes from './users/general.user.public.route';
import generalUserSecureRoutes from './users/general.user.secure.route';
import generalPropertyRoutes from './properties/general.properties.public.route';
import reservationRoutes from './reservation/general.reservation.secure.route';
import verifyRoutesAndAuthorizedRoles from '../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import generalPromoRoute from './coupon/general.promo.routes';
import * as commonNotificationController from './../../controllers/common/notifications/common.notification.controller';
import othersSecureUploadRoutes from '../others/uploads/others.uploads.public.route';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| User Routes
|--------------------------------------------------------------------------
| - Public routes (e.g., signup, login) are accessible without authentication.
| - Secure routes (e.g., profile updates, account settings) require authentication.
| - Users must be either a "guest" or "host" to access secure routes.
*/
router.use('/', generalUserPublicRoutes);
//protect inside by middlware
router.use('/user', generalUserSecureRoutes);

/* 
|--------------------------------------------------------------------------
| Reservation Routes
|--------------------------------------------------------------------------
| - These routes handle booking-related operations.
| - Only "guest" and "host" roles are allowed access.
*/
router.use(
   '/reservation',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   reservationRoutes,
);

router.use(
   '/notification',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   commonNotificationController.getUserNotifications,
);
/* 
|--------------------------------------------------------------------------
| Coupon Routes
|--------------------------------------------------------------------------
| - These routes handle coupon-related operations.
| - Only "guest" and "host" roles are allowed access.
*/
router.use(
   '/promo',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   generalPromoRoute,
);

/* 
|--------------------------------------------------------------------------
| Property Routes
|--------------------------------------------------------------------------
| - Public property routes (listing, searching, filtering) are available for all users.
*/
router.use('/properties', generalPropertyRoutes);

/* 
|--------------------------------------------------------------------------
| Upload Routes
|--------------------------------------------------------------------------
| - Secure upload routes for handling file uploads.
*/
router.use(
   '/others/uploads',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   othersSecureUploadRoutes,
);

export default router;
