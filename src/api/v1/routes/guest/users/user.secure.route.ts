import express from 'express';
import * as generalUserWishListController from '../../../controllers/general/user/wishlist.controller';
import * as generalUserAccountController from '../../../controllers/general/user/account.controller';
import * as validateUserAccountInputs from '../../../validation/general/user/general.user.account.validation';
import * as commonUserAccountRoutes from '../../../controllers/common/user/account.controller';
import { upload } from '../../../../uploads/multer';
import { guestBecomeHost } from '../../../controllers/general/user/user.controller';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| User Management Routes (Secure)
|--------------------------------------------------------------------------
| - become host 
*/

router.post(
   '/become-host',
   guestBecomeHost,
);

/* 
|--------------------------------------------------------------------------
| Wishlist Management Routes (Secure)
|--------------------------------------------------------------------------
| - Add or remove properties from wishlist
| - Fetch all wishlist properties (paginated)
*/
router.post(
   '/:propertyId/wishlist',
   generalUserWishListController.addPropertyToWishList,
);
router.delete(
   '/:propertyId/wishlist',
   generalUserWishListController.removePropertyFromWishList,
);
router.get(
   '/wishlist',
   generalUserWishListController.showAllWishListProperties,
);

/* 
|--------------------------------------------------------------------------
| User Account Settings (Secure)
|--------------------------------------------------------------------------
| - Manage user profile, OTP, bio, password, and account deactivation
| - Upload profile picture
| - KYC verification and Stripe onboarding
*/
router.get(
   '/account/profile',
   commonUserAccountRoutes.getUserAccountProfile,
);
router.post(
   '/account/profile',
   validateUserAccountInputs.validateAccountUpdateProfile,
   commonUserAccountRoutes.updateUserAccountProfile,
);
router.post(
   '/account/send-otp',
   validateUserAccountInputs.validateAccountSendOtp,
   commonUserAccountRoutes.sendOtpToAccountEmailOrPhone,
);
router.post(
   '/account/verify-otp',
   commonUserAccountRoutes.verifyAccountOtpEmailOrPhone,
);
router.patch(
   '/account/update-bio',
   commonUserAccountRoutes.updateAccountBio,
);
router.patch(
   '/account/update-password',
   commonUserAccountRoutes.updateAccountPassword,
);
router.post(
   '/account/deactivate',
   generalUserAccountController.deactiveUserAccount,
);
router.patch(
   '/account/upload-picture',
   upload.single('file'),
   generalUserAccountController.updateProfilePicture,
);

export default router;
