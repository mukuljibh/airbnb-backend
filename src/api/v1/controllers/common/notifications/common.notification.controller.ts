import { Request, Response, NextFunction } from 'express';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { Notification } from '../../../models/notification/notification';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';

export async function getUserNotifications(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;

   try {
      const notifications = await Notification.find({ userId: user._id });
      res.status(200).json(
         new ApiResponse(
            200,
            'Notifications fetched sucessfully',
            notifications,
         ),
      );
   } catch (err) {
      next(err);
   }
}

export async function deleteUserNotification(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const notificationId = validateObjectId(req.params.notificationId);
      const notification = await Notification.findOne({
         _id: notificationId,
         userId: user._id,
      });
      if (!notification) {
         return res.status(400).json('No notification found to delete');
      }
      await notification.deleteOne();
      res.status(200).json('Notifications deleted sucessfully');
   } catch (err) {
      next(err);
   }
}

export async function updateUserNotification(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const notificationId = validateObjectId(req.params.notificationId);
      const notification = await Notification.findOneAndUpdate(
         {
            _id: notificationId,
            userId: user._id,
         },
         { $set: { isRead: true } },
      );
      if (!notification) {
         return res.status(400).json('No notification found to update');
      }
      res.status(200).json('Notifications updated sucessfully');
   } catch (err) {
      next(err);
   }
}
