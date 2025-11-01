//--------------------------------------------------Secure account settings controllers-------------------------------------------------------

import { Request, Response, NextFunction } from 'express';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { User } from '../../../models/user/user';
import { userLogout } from '../../common/auth/auth.controller';
import { stripe } from '../../../config/stripe';
import { BankDetails } from '../../../models/user/bankDetails';
import Stripe from 'stripe';
import { SessionStore } from '../../../models/session/SessionStore';
import { userDefines } from './jobs/defines/user.define';
import { scheduleUserAccountDeletion } from './jobs';
import { withMongoTransaction } from '../../../utils/mongo-helper/mongo.utils';
import { formatDate } from '../../../utils/dates/dates.utils';
import { changePropertyState } from '../../common/property/property.service';
import { changeUserState } from '../../common/user/services/account.service';
import { doesHostHaveActiveOrUpcomingReservation } from '../../admin/users/services/user.service';
import { createRecipient, dispatchNotification } from '../../common/notifications/services/dispatch.service';
import env from '../../../config/env';

export async function deactiveUserAccount(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { _id: userId } = req.user as ISessionUser;
   try {
      const { reason = 'user decided to close there account' } = req.body
      const targetUser = await User.findOne({ _id: userId }).select('-password')

      const hasReservation = await doesHostHaveActiveOrUpcomingReservation(targetUser._id)

      if (hasReservation) {
         throw new ApiError(409, 'User account cannot be deleted because there are active reservations or trips associated with it.')
      }

      await withMongoTransaction(async (session) => {
         const userChangeState = changeUserState({ userId, userNewStatus: "pending_deletion", reason, role: "user", session })

         const propertyChangeState = changePropertyState({ userId, newPropertyStatus: "pending_deletion", reason, role: "user", session })

         const sessionState = SessionStore.deleteMany({ userId, _id: { $ne: req.session.id } }, { session })

         await Promise.all([userChangeState, propertyChangeState, sessionState])
      })

      const payload = createRecipient('email', {
         type: "AUTO_DELETE_ACCOUNT",
         destination: targetUser.email,
         replacement: { userName: `${targetUser.firstName} ${targetUser.lastName}`, deletionDate: formatDate(new Date()) }
      })

      dispatchNotification({ recipients: [payload] })

      scheduleUserAccountDeletion({ userId })
         .catch(() => console.log(`error scheduling ${userDefines.AUTO_DELETE_ACCOUNT} job`))


      await userLogout(req, res, next);
   } catch (err) {
      // console.log(err);

      next(err);
   }
}

export async function updateProfilePicture(req, res, next: NextFunction) {
   const user = req.user as ISessionUser;
   try {
      const dbUser = await User.findOne({ _id: user._id });
      if (!req.file) {
         throw new ApiError(
            400,
            'Please provide only single image in multipart form-data',
         );
      }
      dbUser.profilePicture = req.file.path;
      await dbUser.save();
      res.status(200).json(
         new ApiResponse(200, 'profile picture updated Successfully'),
      );
   } catch (err) {
      next(err);
   }
}
export async function createStripeAccount(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;

   try {
      const dbUser = await User.findById(user._id);
      if (!dbUser) {
         return res.status(404).json(new ApiResponse(404, 'User not found.'));
      }

      // Ensure bank details exist
      let bankDetails = await BankDetails.findOne({ userId: dbUser._id });
      if (bankDetails) {
         if (bankDetails.status === 'verified') {
            throw new ApiError(400, 'Your bank details is already verified');
         }
      }
      if (!bankDetails) {
         bankDetails = new BankDetails({ userId: dbUser._id });
         await bankDetails.save();
      }

      // Create a Stripe account if one doesn't exist
      if (!bankDetails.stripeConnectId) {
         const account = await stripe.accounts.create({
            type: 'express' as Stripe.AccountCreateParams.Type,
            country: 'US',
            email: dbUser.email,
            capabilities: {
               transfers: { requested: true },
               card_payments: { requested: true },
            },
            business_type:
               'individual' as Stripe.AccountCreateParams.BusinessType,
            individual: {
               first_name: dbUser.firstName,
               last_name: dbUser.lastName,
               // Add other required fields for India
            },
            metadata: {
               userId: dbUser._id.toString(),
               bankId: bankDetails._id.toString(),
            },
         });
         bankDetails.stripeConnectId = account.id;
         await bankDetails.save();
      }

      // Generate onboarding link
      const onboarding = await stripe.accountLinks.create({
         account: bankDetails.stripeConnectId,
         type: 'account_onboarding',

         refresh_url: 'http://localhost:5173/verify-user',
         return_url: 'http://localhost:5173/verify-user',
         collect: 'eventually_due',
      });

      return res
         .status(201)
         .json(
            new ApiResponse(
               201,
               'Please continue with this link to submit your relevant details.',
               onboarding,
            ),
         );
   } catch (err) {
      next(err);
   }
}

export async function updateBankDetails(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;

   try {
      const dbUser = await User.findById(user._id);
      if (!dbUser) {
         return res.status(404).json(new ApiResponse(404, 'User not found.'));
      }

      // Ensure bank details exist
      const bankDetails = await BankDetails.findOne({ userId: dbUser._id });
      if (!bankDetails) {
         throw new ApiError(
            400,
            'you dont have stripe bank details set please set it first before updating',
         );
      }

      // Generate onboarding link
      const onboarding = await stripe.accountLinks.create({
         account: bankDetails?.stripeConnectId,
         type: 'account_onboarding',
         refresh_url: 'http://localhost:5173/verify-user',
         return_url: 'http://localhost:5173/verify-user',
      });

      return res
         .status(201)
         .json(
            new ApiResponse(
               201,
               'Please continue with this link to update your relevant details.',
               onboarding,
            ),
         );
   } catch (err) {
      console.log(err);

      next(err);
   }
}

export async function verifyUserKyc(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   let { redirectUrl = '/' } = req.body
   try {

      const dbUser = await User.findById(user._id);
      if (dbUser.verification.status === 'verified') {
         throw new ApiError(409, 'Your KYC has already been completed.');
      }
      const { deviceType } = res.locals.sessionOptions
      const redirectKey = deviceType == "web" ? env.HOST_URL : env.MOBILE_URL

      const return_url = `${redirectKey}${redirectUrl}`

      let verificationSession;

      if (dbUser.verification.id) {
         verificationSession =
            await stripe.identity.verificationSessions.retrieve(
               dbUser.verification.id,
            );
      } else {
         verificationSession =
            await stripe.identity.verificationSessions.create({
               type: 'document',
               metadata: {
                  server_url: env.SERVER_URL,
                  userId: user._id.toString(),
               },
               options: {
                  document: {
                     allowed_types: ['driving_license', 'id_card', 'passport'],
                     require_id_number: true,
                     require_live_capture: true,
                  },
               },
               return_url,
            });
         dbUser.verification.id = verificationSession.id;
         await dbUser.save();
      }

      res.status(200).json({
         message: 'Please continue with this link to complete you kyc',
         url: verificationSession.url,
      });
   } catch (err) {
      console.log(err);

      next(err);
   }
}
