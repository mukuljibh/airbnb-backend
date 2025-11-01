import express from 'express';
import * as commonAuthController from '../../../controllers/common/auth/auth.controller'

import * as generalUserAuthValidation from '../../../validation/general/user/general.user.auth.validation';
import { verifyProfileSession } from '../../../middleware/authentication/verifyProfileSession';
import { verifyUserOtpSession } from '../../../middleware/authentication/verifyUserOtpSession';
import passport from 'passport';
import verifyRoutesAndAuthorizedRoles from '../../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import { COOKIE_KEYS } from '../../../constant/cookie.key.constant';
const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
| - Handles OTP-based authentication, login, logout, and password changes.
| - Includes session-based profile submission.
*/
router.post(
    '/send-otp',
    generalUserAuthValidation.validateSendOtp,
    commonAuthController.handleSendOtp,
);
router.post(
    '/verify-otp',
    generalUserAuthValidation.validateVerifyOtp,
    verifyUserOtpSession,
    commonAuthController.verifyUserOtp,
);
router.post(
    '/submit-profile',
    generalUserAuthValidation.validateProfile,
    verifyProfileSession(COOKIE_KEYS.PROFILE_SESSION_ID),
    commonAuthController.submitProfileDetails,
);
router.post(
    '/logout',
    verifyRoutesAndAuthorizedRoles('guest', 'host'),
    commonAuthController.userLogout,
);
router.post(
    '/login',
    generalUserAuthValidation.ValidateLogin,
    commonAuthController.userLogin,
);
router.patch(
    '/change-password',
    generalUserAuthValidation.validateChangePassword,
    verifyProfileSession(COOKIE_KEYS.PROFILE_SESSION_ID),
    commonAuthController.userChangePassword,
);

/* 
|--------------------------------------------------------------------------
| OAuth Authentication Routes
|--------------------------------------------------------------------------
| - Google and Facebook authentication using Passport.js.
| - Redirects to client-side login page on failure.
*/
router.get(
    '/facebook',
    passport.authenticate('facebook', { scope: ['public_profile', 'email'] }),
);

router.get(
    '/facebook/callback',
    passport.authenticate('facebook', {
        failureRedirect: `${process.env.GUEST_URL}/login`,
    }),
    (req, res) => {
        console.log(req.cookies);
        res.redirect(`${process.env.GUEST_URL}`);
        return;
    },
);
router.post('/login/google', commonAuthController.googleLogin);

/* 
|--------------------------------------------------------------------------
| Host-Specific Routes
|--------------------------------------------------------------------------
| - Fetches host-related statistics, reviews, and published properties.
| - Supports pagination where necessary.
*/

export default router