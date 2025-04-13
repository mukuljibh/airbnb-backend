import express from 'express';

import * as commonNotificationController from './../../../controllers/common/notifications/common.notification.controller';

const router = express.Router();

router.get('/', commonNotificationController.getUserNotifications);
router.patch(
   '/:notificationId',
   commonNotificationController.updateUserNotification,
);
router.delete(
   '/:notificationId',
   commonNotificationController.deleteUserNotification,
);

export default router;
