import express from 'express';
import * as adminUserSettingsController from '../../../controllers/admin/users/admin.userSettings.controllers';
import { getHostStatistics } from '../../../controllers/general/user/general.user.controller';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| User Management Routes
|--------------------------------------------------------------------------
*/
router.get('/', adminUserSettingsController.getUsersList);
router.get('/host-statistics/:hostId', getHostStatistics);

router.get(
   '/:hostId',
   adminUserSettingsController.getHostPropertiesWithReviews,
);

router.put('/:id', adminUserSettingsController.updateUserById);
router.delete('/:id', adminUserSettingsController.deleteUserById);

export default router;
