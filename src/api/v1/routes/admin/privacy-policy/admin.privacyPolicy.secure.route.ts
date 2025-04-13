import express from 'express';
import { validatePrivacyPolicy } from '../../../validation/admin/privacy-policy/admin.privacyPolicy.validation';
import * as adminPrivacyPolicyController from '../../../controllers/admin/privacy-policy/admin.privacyPolicy.controller';

const router = express.Router();

/* 
|-------------------------------------------------------------------
| Privacy Policy Management Routes (Admin Only)
|-------------------------------------------------------------------
| These routes allow admins to create and update privacy policies.
| - POST: Adds a new privacy policy.
| - PATCH: Updates an existing privacy policy based on policyId.
*/
router.post(
   '/',
   validatePrivacyPolicy,
   adminPrivacyPolicyController.postPrivacyPolicies,
);
router.patch(
   '/:policyId',
   validatePrivacyPolicy,
   adminPrivacyPolicyController.updatePolicyDetails,
);

export default router;
