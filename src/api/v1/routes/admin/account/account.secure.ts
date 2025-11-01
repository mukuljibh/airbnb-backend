import express from 'express';

import * as commonUserAccountController from '../../../controllers/common/user/account.controller';
import * as adminAccountSettingController from '../../../controllers/admin/account/account.controller';

const router = express.Router();
/* 
|-------------------------------------------------------------------
| Admin Account Management Routes
|-------------------------------------------------------------------
*/

/* 
| Route for admins to update their account password.
| Ensures the old password is provided and validates the new password format.
*/
router.patch(
   '/update-password',
   commonUserAccountController.updateAccountPassword,
);

router.get('/profile', commonUserAccountController.getUserAccountProfile);
router.patch(
   '/profile',
   adminAccountSettingController.updateUserAccountProfile,
);

export default router;
