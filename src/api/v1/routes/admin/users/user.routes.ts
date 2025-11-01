import express from 'express';
import * as adminUserSettingsController from '../../../controllers/admin/users/user.controllers';
import { getHostStatistics } from '../../../controllers/general/user/user.controller';
import * as commonUserReviewsController from '../../../controllers/common/user/reviews.controller';
import createPages from '../../../middleware/pagination/pagination.middleware';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| User Queries Management
|--------------------------------------------------------------------------
*/
router.get('/queries', createPages, adminUserSettingsController.getUserQueries);
router.patch('/queries/:queryId', adminUserSettingsController.respondUserQuery);

/* 
|--------------------------------------------------------------------------
| Users List
|--------------------------------------------------------------------------
*/
router.get('/', adminUserSettingsController.getUsersList);

/* 
|--------------------------------------------------------------------------
| Host-specific Data
|--------------------------------------------------------------------------
*/
router.get('/host-statistics/:hostId', getHostStatistics);
router.get('/host-reviews/:hostId', createPages, commonUserReviewsController.getHostPropertiesAllReviews);

/* 
|--------------------------------------------------------------------------
| Host Properties Retrieval
|--------------------------------------------------------------------------
*/
router.get('/:userId', adminUserSettingsController.getHostPropertiesWithReviews);

/* 
|--------------------------------------------------------------------------
| User Account Actions
|--------------------------------------------------------------------------
*/
router.patch('/:userId/suspend', adminUserSettingsController.suspendUserAccount);
router.patch('/:userId/unsuspend', adminUserSettingsController.unsuspendUserAccount);
router.patch('/:userId/delete', adminUserSettingsController.permanentDeleteAccount);

export default router;
