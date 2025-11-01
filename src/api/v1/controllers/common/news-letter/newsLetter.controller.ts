import { Request, Response, NextFunction } from 'express';
import Newsletter from '../../../models/newsLetter';
import { emailRegix } from '../../../constant/regex.constant';
import { emailEmitter } from '../../../events/email/email.emitter';
export async function subscribeNewsLetter(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { email } = req.body;

      if (!email) {
         return res.status(400).json({ message: 'Email is required.' });
      }
      if (!emailRegix.test(email)) {
         return res.status(400).json({ message: 'Invalid email format.' });
      }
      // Check if already subscribed
      const existing = await Newsletter.findOne({ email });
      if (existing && existing.status === 'subscribed') {
         return res
            .status(409)
            .json({ message: 'You are already subscribed.' });
      }

      await Newsletter.create({ email });
      emailEmitter.emit('email:send', {
         type: 'SUBSCRIBE_NEWSLETTER',
         destination: email,
         replacement: {
            email,
         },
      });
      res.status(201).json({
         message:
            'You have successfully subscribed to our newsletter. See you in the mailbox!',
      });
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function unSubscribeNewsLetter(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { email } = req.body;

      if (!email) {
         return res.status(400).json({ message: 'Email is required.' });
      }

      const newsLetter = await Newsletter.findOneAndUpdate(
         { email },
         { status: 'unsubscribed', unSubscribedAt: new Date() },
         { new: true },
      );

      if (!newsLetter) {
         return res.status(404).json({
            message:
               'You are not subscribed to our newsletter. Please subscribe first.',
         });
      }

      res.status(200).json({
         message: 'You have successfully unsubscribed from our newsletter.',
      });
   } catch (err) {
      console.log(err);
      next(err);
   }
}
