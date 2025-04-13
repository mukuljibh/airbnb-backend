import { Notification } from '../../models/notification/notification';
export async function sendNotification({
   userId,
   title,
   message,
   type,
   metadata = {},
   genericRef,
   typeRef,
}) {
   try {
      await Notification.create({
         userId,
         title,
         message,
         type,
         metadata,
         genericRef,
         typeRef,
      });
   } catch (err) {
      console.error('Error sending notification:', err.message);
   }
}
