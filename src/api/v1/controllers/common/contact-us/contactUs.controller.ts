import { NextFunction, Request, Response } from 'express';
import UserQuery from '../../../models/userQuery';
import { emailRegix } from '../../../constant/regex.constant';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { createRecipient, dispatchNotification } from '../notifications/services/dispatch.service';

export async function sendQueryMessage(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { name, email, subject, query } = req.body;
   if (!name || !email || !subject || !query) {
      return res.status(400).json({ message: 'All fields are required.' });
   }

   if (!emailRegix.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
   }

   try {
      const userQuery = await UserQuery.findOne({
         email,
         status: { $eq: 'open' },
      });
      if (userQuery) {
         throw new ApiError(
            400,
            'Your query is under process. Please wait while we are processing your previous request.',
         );
      }

      await UserQuery.create({ name, email, subject, query });

      const payload = createRecipient('both', {
         emailOptions: {
            type: "USER_QUERY_ACK",
            destination: email,
            replacement: { name },
         },
         notificationOptions: {
            userId: '67ca938ba2116899a6cb24c2',
            title: 'New User Query Received',
            message: 'A user has submitted a new query. Please review it.',
            visibleToRoles: ["admin"],
            redirectKey: null,
            metadata: null
         }

      },)
      dispatchNotification({
         recipients: [payload],
      });

      return res.json({
         message:
            'Thank you for contacting us. You will receive support from our customer service soon.',
      });
   } catch (err) {
      next(err);
   }
}
