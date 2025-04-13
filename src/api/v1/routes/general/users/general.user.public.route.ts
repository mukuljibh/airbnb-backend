import express from 'express';
import * as generalUserController from '../../../controllers/general/user/general.user.controller';
import * as commonUserControllerCommon from '../../../controllers/common/user/common.user.controller';
import * as generalUserAuthValidation from '../../../validation/general/user/general.user.auth.validation';
import { verifyProfileSession } from '../../../middleware/authentication/verifyProfileSession';
import { verifyUserOtpSession } from '../../../middleware/authentication/verifyUserOtpSession';
import passport from 'passport';
import verifyRoutesAndAuthorizedRoles from '../../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import createPages from '../../../middleware/pagination/createPages';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
| - Handles OTP-based authentication, login, logout, and password changes.
| - Includes session-based profile submission.
*/
router.post(
   '/auth/send-otp',
   generalUserAuthValidation.validateSendOtp,
   commonUserControllerCommon.sendOtpToEmail,
);
router.post(
   '/auth/verify-otp',
   generalUserAuthValidation.validateVerifyOtp,
   verifyUserOtpSession,
   commonUserControllerCommon.verifyUserOtp,
);
router.post(
   '/auth/submit-profile',
   generalUserAuthValidation.validateProfile,
   verifyProfileSession('profilesessionid'),
   generalUserController.submitProfileDetails,
);
router.post(
   '/auth/logout',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   commonUserControllerCommon.userLogout,
);
router.post(
   '/auth/login',
   generalUserAuthValidation.ValidateLogin,
   commonUserControllerCommon.userLogin,
);
router.patch(
   '/auth/change-password',
   generalUserAuthValidation.validateChangePassword,
   verifyProfileSession('profilesessionid'),
   commonUserControllerCommon.userChangePassword,
);

/* 
|--------------------------------------------------------------------------
| OAuth Authentication Routes
|--------------------------------------------------------------------------
| - Google and Facebook authentication using Passport.js.
| - Redirects to client-side login page on failure.
*/
router.get(
   '/auth/google',
   passport.authenticate('google', { scope: ['profile', 'email'] }),
);
router.get(
   '/auth/facebook',
   passport.authenticate('facebook', { scope: ['public_profile', 'email'] }),
);
router.get(
   '/auth/google/callback',
   passport.authenticate('google', {
      failureRedirect: `${process.env.CLIENT_URL}/login`,
   }),
   commonUserControllerCommon.googleCallback,
);
router.get(
   '/auth/facebook/callback',
   passport.authenticate('facebook', {
      failureRedirect: `${process.env.CLIENT_URL}/login`,
   }),
   (req, res) => {
      console.log(req.cookies);
      res.redirect(`${process.env.CLIENT_URL}`);
      return;
   },
);

/* 
|--------------------------------------------------------------------------
| Host-Specific Routes
|--------------------------------------------------------------------------
| - Fetches host-related statistics, reviews, and published properties.
| - Supports pagination where necessary.
*/
router.get(
   '/all-reviews/:hostId',
   createPages,
   generalUserController.getHostPropertiesAllReviews,
);
router.get(
   '/all-published/:hostId',
   createPages,
   generalUserController.getHostAllPublishedProperties,
);
router.get('/host-statistics', generalUserController.getHostStatistics);
router.get('/host-statistics/:hostId', generalUserController.getHostStatistics);
export default router;
