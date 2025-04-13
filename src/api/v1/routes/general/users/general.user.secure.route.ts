import express from 'express';
import createPages from '../../../middleware/pagination/createPages';
import verifyRoutesAndAuthorizedRoles from '../../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import * as generalUserWishListController from '../../../controllers/general/user/general.user.wishlist.controller';
import * as generalUserPropertyDraftController from '../../../controllers/general/user/general.user.draft.controller';
import * as generalUserAccountController from '../../../controllers/general/user/general.user.account.controller';
import * as generalUserReviewController from '../../../controllers/general/user/general.user.review.controller';
import * as validateUserAccountInputs from '../../../validation/general/user/general.user.account.validation';
import * as commonUserAccountRoutes from '../../../controllers/common/user/common.user.account.controller';
import * as generalUserValidationRoutes from '../../../validation/general/user/general.user.draft.validation';
import { upload } from '../../../../uploads/multer';
import { getPropertiesList } from '../../../controllers/common/property/common.property.controller';
import { guestBecomeHost } from '../../../controllers/general/user/general.user.controller';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| User Management Routes (Secure)
|--------------------------------------------------------------------------
| - become host 
*/

router.post(
   '/become-host',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   guestBecomeHost,
);
/* 
|--------------------------------------------------------------------------
| Property Management Routes (Secure)
|--------------------------------------------------------------------------
| - Toggle property status
| - Fetch properties/drafts with filters
| - Delete a published or draft property
*/
router.patch(
   '/property/:propertyId/toggle-status',
   verifyRoutesAndAuthorizedRoles('host'),
   generalUserPropertyDraftController.togglePropertyStatus,
);
router.get(
   '/properties',
   verifyRoutesAndAuthorizedRoles('host'),
   createPages,
   getPropertiesList,
);
router.delete(
   '/property/:propertyId',
   verifyRoutesAndAuthorizedRoles('host'),

   generalUserPropertyDraftController.deleteProperty,
);

/* 
|--------------------------------------------------------------------------
| Draft Property Operations
|--------------------------------------------------------------------------
| - Get a single draft or published property
| - Save/update draft checkpoints
| - Submit a draft for final approval
*/
router.get(
   '/draft/:draftId',
   verifyRoutesAndAuthorizedRoles('host'),
   generalUserPropertyDraftController.getSingleDraftOrProperty,
);
router.post(
   '/draft/:draftId/checkpoint',
   verifyRoutesAndAuthorizedRoles('host'),
   generalUserValidationRoutes.validateCheckpoint,
   generalUserPropertyDraftController.saveCheckpointDraft,
);
router.patch(
   '/draft/:draftId/checkpoint',
   verifyRoutesAndAuthorizedRoles('host'),

   generalUserValidationRoutes.validateCheckpoint,
   generalUserPropertyDraftController.updateCheckpoint,
);
router.post(
   '/draft/:draftId/submit-for-approval',
   verifyRoutesAndAuthorizedRoles('host'),
   generalUserPropertyDraftController.makeRequestForApproval,
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
   verifyRoutesAndAuthorizedRoles('guest'),
   generalUserWishListController.addPropertyToWishList,
);
router.delete(
   '/:propertyId/wishlist',
   verifyRoutesAndAuthorizedRoles('guest'),
   generalUserWishListController.removePropertyFromWishList,
);
router.get(
   '/wishlist',
   verifyRoutesAndAuthorizedRoles('guest'),
   createPages,
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
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   commonUserAccountRoutes.getUserAccountProfile,
);
router.post(
   '/account/profile',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   validateUserAccountInputs.validateAccountUpdateProfile,
   commonUserAccountRoutes.updateUserAccountProfile,
);
router.post(
   '/account/send-otp',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   validateUserAccountInputs.validateAccountSendOtp,
   commonUserAccountRoutes.sendOtpToAccountEmailOrPhone,
);
router.post(
   '/account/verify-otp',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   commonUserAccountRoutes.verifyAccountOtpEmailOrPhone,
);
router.patch(
   '/account/update-bio',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   commonUserAccountRoutes.updateAccountBio,
);
router.patch(
   '/account/update-password',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   commonUserAccountRoutes.updateAccountPassword,
);
router.post(
   '/account/deactivate',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   generalUserAccountController.deactiveUserAccount,
);
router.patch(
   '/account/upload-picture',
   upload.single('file'),
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   generalUserAccountController.updateProfilePicture,
);
router.post(
   '/account/kyc',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),
   generalUserAccountController.verifyUserKyc,
);
router.post(
   '/account/onboarding-link',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   generalUserAccountController.createStripeAccount,
);

router.patch(
   '/account/update-bank-details',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   generalUserAccountController.updateBankDetails,
);
/* 
|--------------------------------------------------------------------------
| User Review Management (Secure)
|--------------------------------------------------------------------------
| - Fetch, add, update, or delete property reviews
*/
router.get(
   '/property/:propertyId/review',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   generalUserReviewController.getUserReview,
);
router.post(
   '/property/:propertyId/review',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   generalUserReviewController.postUserReview,
);
router.patch(
   '/property/:propertyId/review',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   generalUserReviewController.updateUserReviews,
);
router.delete(
   '/property/:propertyId/review',
   verifyRoutesAndAuthorizedRoles('guest', 'host'),

   generalUserReviewController.deleteUserReview,
);

export default router;
