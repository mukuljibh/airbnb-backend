import express from 'express';
import * as generalUserPropertyDraftController from '../../../controllers/general/user/draft.controller';
import * as generalUserAccountController from '../../../controllers/general/user/account.controller';
import * as propertyUpdateController from '../../../controllers/general/user/update.controller';

import * as generalUserReviewController from '../../../controllers/general/user/review.controller';
import * as validateUserAccountInputs from '../../../validation/general/user/general.user.account.validation';
import * as commonUserAccountRoutes from '../../../controllers/common/user/account.controller';
import * as generalUserValidationRoutes from '../../../validation/general/user/general.user.draft.validation';
import { upload } from '../../../../uploads/multer';
import { validatePropertyUpdate } from '../../../validation/general/property/general.properties.validation';
import verifyUserAccountStatus from '../../../middleware/authorization/verifyUserStatus';

const router = express.Router();


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
   generalUserPropertyDraftController.togglePropertyStatus,
);
router.patch(
   '/property/:propertyId/toggle-booking',
   verifyUserAccountStatus,
   generalUserPropertyDraftController.toggleBookingStatus,
);
router.get(
   '/properties',
   generalUserPropertyDraftController.getHostPropertyListByFilter,
);

router.delete(
   '/property/:propertyId',
   generalUserPropertyDraftController.deletePropertyById,
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
   '/property/:propertyId',
   generalUserPropertyDraftController.getSingleDraftOrProperty,
);
router.post(
   '/property',
   generalUserValidationRoutes.validateCheckpoint,
   generalUserPropertyDraftController.saveCheckpointDraft,
);
router.patch(
   '/property/:propertyId/checkpoint',
   generalUserValidationRoutes.validateCheckpoint,
   verifyUserAccountStatus,
   generalUserPropertyDraftController.updateCheckpoint,
);
router.post(
   '/draft/:draftId/submit-for-approval',
   verifyUserAccountStatus,
   generalUserPropertyDraftController.makeRequestForApproval,
);

router.get(
   '/property/:propertyId/preview',
   generalUserPropertyDraftController.getPropertyOrDraftPreview,
);


//request for property document update ----------------------------------------------------------

router.get(
   '/property/:propertyId/updates/edit-context',
   propertyUpdateController.getPropertyDetailsForUpdate
);

router.get(
   '/property/:propertyId/updates',
   propertyUpdateController.getPropertyUpdateRequestHistory
);

router.get(
   '/property/:propertyId/updates/:updateId',
   propertyUpdateController.getPropertyUpdateById
);

router.post(
   '/property/:propertyId/updates',
   validatePropertyUpdate,
   verifyUserAccountStatus,
   propertyUpdateController.submitUpdateRequest
);

/* 
|--------------------------------------------------------------------------
| User Account Settings (Secure)
|--------------------------------------------------------------------------
| - Manage user profile, OTP, bio, password, and account deactivation
| - Upload profile picture
| - KYC verification and Stripe onboarding
*/
//removing after confirmation
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
router.post(
   '/account/kyc',
   verifyUserAccountStatus,
   generalUserAccountController.verifyUserKyc,
);
router.post(
   '/account/onboarding-link',
   generalUserAccountController.createStripeAccount,
);

router.patch(
   '/account/update-bank-details',
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
   generalUserReviewController.getUserReview,
);
router.post(
   '/property/:propertyId/review',
   generalUserReviewController.postUserReview,
);
router.patch(
   '/property/:propertyId/review',
   generalUserReviewController.updateUserReviews,
);
router.delete(
   '/property/:propertyId/review',
   generalUserReviewController.deleteUserReview,
);

export default router;
