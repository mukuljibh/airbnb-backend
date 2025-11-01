import express from 'express';
import * as commonAuthController from '../../../controllers/common/auth/auth.controller'
import { validateVerifyOtp } from '../../../validation/general/user/general.user.auth.validation';
import { verifyProfileSession } from '../../../middleware/authentication/verifyProfileSession';
import * as  generalUserAuthValidation from "../../../validation/general/user/general.user.auth.validation"

import verifyRoutesAndAuthorizedRoles from '../../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import { COOKIE_KEYS } from '../../../constant/cookie.key.constant';

const router = express.Router();

/* 
|-------------------------------------------------------------------
| Public Authentication Routes (No Admin Verification Required)
|-------------------------------------------------------------------
| These routes handle admin role authentication.
*/
router.post('/login', commonAuthController.userLogin);
router.post('/send-otp',
   generalUserAuthValidation.validateSendOtp,
   commonAuthController.handleSendOtp);
router.post(
   '/verify-otp',
   validateVerifyOtp,
   commonAuthController.verifyUserOtp,
);

// Change password requires profile session verification
router.patch(
   '/change-password',
   verifyProfileSession(COOKIE_KEYS.PROFILE_SESSION_ID),
   commonAuthController.userChangePassword,
);

// Logout route, but it requires admin role verification
router.post(
   '/logout',
   verifyRoutesAndAuthorizedRoles('admin'),
   commonAuthController.userLogout,
);
export default router;
