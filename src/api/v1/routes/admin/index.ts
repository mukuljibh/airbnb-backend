import express from 'express';
import verifyRoutesAndAuthorizedRoles from '../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import adminPropertySettingsRoutes from './properties/admin.properties.settings.secure.routes';
import adminUserSettingsRoutes from './users/admin.user.settings.secure.routes';
import * as commonUserController from '../../controllers/common/user/common.user.controller';
import { verifyProfileSession } from '../../middleware/authentication/verifyProfileSession';
import { validateVerifyOtp } from '../../validation/general/user/general.user.auth.validation';
import adminPrivacyPolicyRoutes from './privacy-policy/admin.privacyPolicy.secure.route';
import otherRoutes from './../others/index';
import adminReservationRoutes from './reservation/admin.reservation.settings.secure.route';
import adminAccountSettingRoutes from './account/admin.account.settings.secure';
import adminPromoRoutes from './promo/admin.promo.routes';
import adminAnalyticsRoutes from './analytics/admin.analytics.route';
const router = express.Router();

/* 
|-------------------------------------------------------------------
| Public Authentication Routes (No Admin Verification Required)
|-------------------------------------------------------------------
| These routes handle admin role authentication.
*/
router.post('/auth/login', commonUserController.userLogin);
router.post('/auth/send-otp', commonUserController.sendOtpToEmail);
router.post(
   '/auth/verify-otp',
   validateVerifyOtp,
   commonUserController.verifyUserOtp,
);

// Change password requires profile session verification
router.patch(
   '/auth/change-password',
   verifyProfileSession('profilesessionid'),
   commonUserController.userChangePassword,
);

// Logout route, but it requires admin role verification
router.post(
   '/auth/logout',
   verifyRoutesAndAuthorizedRoles('admin'),
   commonUserController.userLogout,
);
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

// Miscellaneous Routes
router.use('/others', verifyRoutesAndAuthorizedRoles('admin'), otherRoutes);

export default router;
