import express from 'express';
import verifyRoutesAndAuthorizedRoles from '../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import adminPropertySettingsRoutes from './properties/properties.routes';
import adminUserSettingsRoutes from './users/user.routes';
import adminPrivacyPolicyRoutes from './privacy-policy/privacyPolicy.route';
import otherRoutes from './../others/index';
import adminReservationRoutes from './reservation/reservation.route';
import adminAccountSettingRoutes from './account/account.secure';
import adminPromoRoutes from './promo/promo.routes';
import adminAnalyticsRoutes from './analytics/analytics.route';
import adminNotificationRoute from './notification/notification.route';
import adminAuthRoute from './auth/auth.route';
import adminConversationRoute from "./conversations/conversation.route"
import adminHelpRoute from "./../admin/help/help.route"
const router = express.Router();

// all admin login kind of operation proceed from here
router.use('/auth', adminAuthRoute);

// all analytics kind of operation proceed from here
router.use(
   '/analytics',
   verifyRoutesAndAuthorizedRoles('admin'),
   adminAnalyticsRoutes,
);
/* 
|-------------------------------------------------------------------
| Admin Protected Routes (Require Authorization)
|-------------------------------------------------------------------
| These routes are restricted to users with admin privileges.
*/

// Properties Management Routes
router.use(
   '/properties',
   verifyRoutesAndAuthorizedRoles('admin'),
   adminPropertySettingsRoutes,
);

// User Management Routes
router.use(
   '/users',
   verifyRoutesAndAuthorizedRoles('admin'),
   adminUserSettingsRoutes,
);

// Account Settings Routes
router.use(
   '/account',
   verifyRoutesAndAuthorizedRoles('admin'),
   adminAccountSettingRoutes,
);
// coupons Management Routes

router.use('/promo', verifyRoutesAndAuthorizedRoles('admin'), adminPromoRoutes);

// Reservation Management Routes
router.use(
   '/reservation',
   verifyRoutesAndAuthorizedRoles('admin'),
   adminReservationRoutes,
);

router.use(
   '/notification',
   verifyRoutesAndAuthorizedRoles('admin'),
   adminNotificationRoute,
);


router.use('/conversations', verifyRoutesAndAuthorizedRoles('admin'), adminConversationRoute)
/* 
|-------------------------------------------------------------------
| Public Routes (Require Authorization)
|-------------------------------------------------------------------
  These routes are restricted to users with admin privileges
*/

// Privacy Policy Routes
router.use(
   '/privacy-policies',
   verifyRoutesAndAuthorizedRoles('admin'),
   adminPrivacyPolicyRoutes,
);

// Privacy Policy Routes
router.use(
   '/help',
   verifyRoutesAndAuthorizedRoles('admin'),
   adminHelpRoute,
);

// Miscellaneous Routes
router.use('/others', verifyRoutesAndAuthorizedRoles('admin'), otherRoutes);

export default router;
