import EventEmitter from 'events';
import { sendNotification } from '../../controllers/common/notifications/services/notification.service';

export const notificationEmitter = new EventEmitter();

notificationEmitter.on('notification:send', (payload) => {
   const {
      userId,
      title,
      message,
      category,
      metadata,
      visibleToRoles,
      relatedDocId,
      relatedModel,
      redirectKey,

   } = payload;

   setImmediate(() => {
      sendNotification({
         userId,
         title,
         message,
         category,
         metadata,
         visibleToRoles,
         relatedDocId,
         relatedModel,
         redirectKey,
      });
   });
});
