import express from 'express';
import * as generalUserController from '../../../controllers/general/user/user.controller';
import * as commonUserReviewController from '../../../controllers/common/user/reviews.controller';

import createPages from '../../../middleware/pagination/pagination.middleware';
const router = express.Router();


/* 
|--------------------------------------------------------------------------
| Host-Specific Routes
|--------------------------------------------------------------------------
| - Fetches host-related statistics, reviews, and published properties.
| - Supports pagination where necessary.
*/

router.get(
   '/my-reviews',
   createPages,
   commonUserReviewController.getHostPropertiesAllReviews,
);
router.get(
   '/all-reviews/:hostId',
   createPages,
   commonUserReviewController.getHostPropertiesAllReviews,
);

router.get(
   '/all-published/:hostId',
   createPages,
   generalUserController.getHostAllPublishedProperties,
);

router.get('/host-statistics', generalUserController.getHostStatistics);
router.get('/host-statistics/:hostId', generalUserController.getHostStatistics);
export default router;
