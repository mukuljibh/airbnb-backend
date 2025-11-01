import express from 'express';
import hostPublicRoutes from './public/public.route';
import hostUserSecureRoutes from './users/user.route';
import hostPropertyRoutes from './properties/properties.route';
import reservationRoutes from './reservation/reservation.route';
import verifyRoutesAndAuthorizedRoles from '../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import hostNotificationRoute from './notification/notification.route';
import othersSecureUploadRoutes from '../others/uploads/uploads.route';
import hostAnalyticsRoute from './analytics/analytics.route';
import hostConversationRoute from './conversations/conversations.route'
import hostAuthRoutes from "./auth/auth.route"
import hostSessionRoutes from '../host/session/session.route'
// import { verifySSOLogin } from '../../controllers/general/session/session.controller';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| User Routes
|--------------------------------------------------------------------------
| - Public routes (e.g., signup, login) are accessible without authentication.
| - Secure routes (e.g., profile updates, account settings) require authentication.
| - Users must be either a "guest" or "host" to access secure routes.
*/

router.use('/', hostPublicRoutes);

router.use('/auth', hostAuthRoutes)
//protect inside by middlware
router.use('/user', verifyRoutesAndAuthorizedRoles('host'), hostUserSecureRoutes);

// verifySSOLogin will create a login session if passed SSO check.
router.use('/sessions', verifyRoutesAndAuthorizedRoles('host'), hostSessionRoutes)


//analytics route
router.use(
   '/analytics',
   verifyRoutesAndAuthorizedRoles('host'),
   hostAnalyticsRoute,
);
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
   hostNotificationRoute,
);



/* 
|--------------------------------------------------------------------------
| Property Routes
|--------------------------------------------------------------------------
| - Public property routes (listing, searching, filtering) are available for all users.
*/
router.use('/properties', hostPropertyRoutes);


router.use(
   '/conversations',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   hostConversationRoute
);
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
