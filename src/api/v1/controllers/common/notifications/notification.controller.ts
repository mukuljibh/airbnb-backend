import { Request, Response, NextFunction } from 'express';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { User } from '../../../models/user/user';
import { deleteNotification, fetchNotifications, markAsRead } from './services/notification.service';

export async function getUserNotifications(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   const { requestOrigin: role } = res.locals.sessionOptions;

   // throw new ApiError(401)
   const { status = 'all' } = req.query as { status: 'all' | 'read' | 'unread' }


   const filter: Record<string, unknown> = {
      visibleToRoles: role,
      userId: user._id,
   }

   if (status == 'read') {
      filter.isRead = true
   }

   if (status == 'unread') {
      filter.isRead = false
   }

   try {
      const result = await fetchNotifications(filter, res.locals.pagination)
      return res.json(result)
   } catch (err) {
      next(err);
   }
}

export async function deleteUserNotificationById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const notificationId = validateObjectId(req.params.notificationId);
      await deleteNotification("single", user._id, notificationId)
      res.status(200).json('Notifications deleted sucessfully');
   } catch (err) {
      next(err);
   }
}


export async function readAllNotifications(
   req: Request,
   res: Response,
) {
   const user = req.user;
   await markAsRead("multiple", user._id);
   return res.json({ message: "All Notifications marked as read." });
}


export async function deleteAllNotifications(
   req: Request,
   res: Response,
) {
   const user = req.user
   await deleteNotification("multiple", user._id);
   return res.json({ message: "All notifications deleted successfully." });

}
export async function markReadNotificationById(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user
   try {
      const notificationId = validateObjectId(req.params.notificationId);

      await markAsRead("single", user._id, notificationId)

      return res.json('Notification updated sucessfully');
   } catch (err) {
      next(err);
   }
}
export async function toggleUserNotification(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user;
   const { messages, accountActivity, newsUpdates, travelTips } = req.body;
   const notificationSettings = {
      messages,
      accountActivity,
      newsUpdates,
      travelTips,
   };
   const validStatuses = [
      'messages',
      'accountActivity',
      'newsUpdates',
      'travelTips',
   ];
   try {
      for (const [key, value] of Object.entries({
         ...notificationSettings,
      })) {
         if (
            typeof key !== 'string' ||
            !validStatuses.includes(key) ||
            typeof value !== 'boolean'
         ) {
            return res
               .status(400)
               .json(
                  new ApiError(
                     400,
                     `Invalid notification setting. Allowed keys: ${validStatuses.join(', ')}. Each value must be a boolean.`,
                  ),
               );
         }
      }

      await User.updateOne({ _id: user._id }, {
         $set: { notificationSettings },
      });

      return res.json({
         message: 'Notification settings updated successfully.',
      });
   } catch (err) {
      next(err);
   }
}
