import express from 'express';
import * as commonNotificationController from '../../../controllers/common/notifications/notification.controller';


const router = express.Router();

router.put('/toggle-notifications', commonNotificationController.toggleUserNotification,);

router.get('/', commonNotificationController.getUserNotifications);

router.patch('/', commonNotificationController.readAllNotifications);

router.delete('/', commonNotificationController.deleteAllNotifications);

router.patch('/:notificationId', commonNotificationController.markReadNotificationById);

router.delete('/:notificationId', commonNotificationController.deleteUserNotificationById);

export default router; 
