import express from 'express';
import guestPublicRoutes from "./public/public.route"
import guestUserSecureRoutes from './users/user.secure.route';
import guestPropertyRoutes from './properties/properties.public.route';
import reservationRoutes from './reservation/reservation.secure.route';
import verifyRoutesAndAuthorizedRoles from '../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import guestPromoRoute from './promo/promo.routes';
import guestNotificationRoute from "./notification/notification.route"
import othersSecureUploadRoutes from '../others/uploads/uploads.route';
import guestConversionsRoute from './conversations/conversations.route'
import guestAuthRoutes from "./auth/auth.route"
import guestSessionRoutes from './session/session.route'

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| User Routes
|--------------------------------------------------------------------------
| - Public routes (e.g., signup, login) are accessible without authentication.
| - Secure routes (e.g., profile updates, account settings) require authentication.
| - Users must be either a "guest" or "host" to access secure routes.
*/
router.use('/', guestPublicRoutes);

router.use('/auth', guestAuthRoutes);

//protect inside by middlware
router.use('/user', verifyRoutesAndAuthorizedRoles('guest'), guestUserSecureRoutes);

router.use('/sessions', verifyRoutesAndAuthorizedRoles('guest'), guestSessionRoutes)


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
   guestNotificationRoute,
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
   guestPromoRoute,
);

/* 
|--------------------------------------------------------------------------
| Property Routes
|--------------------------------------------------------------------------
| - Public property routes (listing, searching, filtering) are available for all users.
*/
router.use('/properties', guestPropertyRoutes);


router.use(
   '/conversations',
   verifyRoutesAndAuthorizedRoles('guest'),
   guestConversionsRoute
);
/* 
|--------------------------------------------------------------------------
| Upload Routes
|--------------------------------------------------------------------------
| - Secure upload routes for handling file uploads.
*/
router.use(
   '/others/uploads',
   verifyRoutesAndAuthorizedRoles('guest'),
   othersSecureUploadRoutes,
);

export default router;
