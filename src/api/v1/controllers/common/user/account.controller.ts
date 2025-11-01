import { omitBy, isUndefined } from 'lodash';
//--------------------------------------------------Secure account settings controllers-------------------------------------------------------
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { CriteriaType, OperationType, PhoneType } from '../auth/types/auth.types';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { User } from '../../../models/user/user';
import {
   decodeJwtToken,
   notifyUserSwitch,
   createDbSessionAndSetCookie,
   PayloadType,
} from '../auth/utils/auth.utils';

import { passwordRegex } from '../../../constant/regex.constant';
import { ISessionUser, IUser } from '../../../models/user/types/user.model.types';
import { errorKeysGenerator } from '../../../utils/error-key-generator/errorKeys.utils';
import { BankDetails } from '../../../models/user/bankDetails';
import { Notification } from '../../../models/notification/notification';
import { SessionStore } from '../../../models/session/SessionStore';
import { confirmUploadResources } from '../../../../uploads/services/upload.service';
import * as commonConversationService from "../conversations/conversation.service"
import { Property } from '../../../models/property/property';
import { COOKIE_KEYS } from '../../../constant/cookie.key.constant';
import { cookieHelper } from '../../../helper/cookies/cookies.helper';
import { sendApiResponseHelper } from '../../../helper/response/response.helper';

export async function getUserAccountProfile(
   req: Request,
   res: Response,
) {
   const user = req.user as ISessionUser;
   const { requestOrigin: currentPanel } = res.locals.sessionOptions

   const roomFilter = { conversationType: `${currentPanel}-admin` }
   const userPromise = User.findOne({ _id: user._id })
      .select(
         `firstName status statusMeta lastName 
         verification email phone address bio role languages 
         profilePicture hasEmailVerified hasPhoneVerified verification
          notificationSettings createdAt`
      )
      .lean<IUser>();

   const bankPromise = BankDetails.findOne({ userId: user._id }).lean<unknown>();

   const notificationPromise = Notification.findOne({
      userId: user._id,
      isRead: false,
      visibleToRoles: currentPanel
   }).select('_id').lean<unknown>();

   const roomPromise = commonConversationService.getRoomDetailsForProperty(roomFilter, user._id, currentPanel);

   const promises = [userPromise, bankPromise, notificationPromise, roomPromise] as const;

   let draftCount = undefined;
   if (currentPanel === 'host') {
      draftCount = await Property.countDocuments({ hostId: user._id, visibility: 'draft' });
   }

   const [userDetails, bankDetails, hasNotifications, roomDetails] = await Promise.all(promises);

   if (userDetails?.statusMeta?.length) {
      const latestStatus = userDetails.statusMeta.at(-1)
      userDetails.statusMeta = latestStatus as any
   }

   const responseData: any = {
      ...userDetails,
      kycStatus: userDetails?.verification?.status || null,
      hasNotifications: !!hasNotifications,
      bankDetails,
      draftCount,
      viewAs: currentPanel
   };
   if (currentPanel !== 'admin') {
      responseData.hasRoomWithAdmin = roomDetails?.hasRoom
      responseData.roomDetails = roomDetails?.hasRoom ? roomDetails : null;
   }
   return res.json(
      new ApiResponse(
         200,
         'User profile information fetched successfully.',
         responseData
      ),
   );

}

export async function updateUserAccountProfile(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const {
      firstName,
      lastName,
      flatNo,
      street,
      city,
      state,
      country,
      pincode,
   } = req.body;
   try {
      const user = req.user as ISessionUser;
      const updatedFields = omitBy(
         {
            firstName: firstName,
            lastName: lastName,
            'address.flatNo': flatNo,
            'address.street': street,
            'address.state': state,
            'address.city': city,
            'address.country': country,
            'address.pincode': pincode,
         },
         isUndefined,
      );
      await User.updateOne({ _id: user._id }, { $set: updatedFields });

      res.status(200).json(
         new ApiResponse(200, 'Profile updated succesfully.'),
      );
   } catch (err) {
      next(err);
   }
}

export async function sendOtpToAccountEmailOrPhone(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { newEmail, newPhone, criteria, type } = req.body as {
      newEmail: string;
      newPhone: PhoneType;
      criteria: CriteriaType;
      type: OperationType;
   };
   const sessionUser = req.user as ISessionUser;
   const user = await User.findById(sessionUser._id);
   const isEmail = criteria === 'EMAIL';
   const verificationField = isEmail ? 'email' : 'phone';
   const verificationValue = isEmail ? newEmail : newPhone;
   const verificationFlag: 'hasEmailVerified' | 'hasPhoneVerified' = isEmail
      ? 'hasEmailVerified'
      : 'hasPhoneVerified';

   const queryToFindOtherUser = isEmail
      ? {
         email: { $regex: new RegExp(`^${newEmail}$`, 'i') },
      }
      : {
         'phone.number': newPhone.number,
      };
   try {
      const dbUser = await User.findById(user._id);

      if (dbUser?.[verificationFlag]) {
         throw new ApiError(400, `your ${verificationField} already verified`);
      }

      const isAnyOtherUserExists = await User.findOne(queryToFindOtherUser);

      if (isAnyOtherUserExists) {
         throw new ApiError(
            400,
            `This ${verificationField} is already in use by another account.`,
         );
      }

      const sessionData = await createDbSessionAndSetCookie(
         user,
         res,
         COOKIE_KEYS.UPDATE_TOKEN,
         '15m',
         {
            type: 'UPDATE',
            verificationFlag,
            verificationValue,
            verificationField,
         },
         req.baseUrl,
      );

      await notifyUserSwitch(
         criteria,
         type,
         {
            otp: sessionData.otp,
            old_email: dbUser.email,
            new_email: newEmail,
         },
         isEmail ? newEmail : newPhone.number,
      );

      res.status(200).json(
         new ApiResponse(200, 'OTP sent Successfully.', {
            otp: sessionData.otp,
         }),
      );
   } catch (err) {
      console.log(err);

      next(err);
   }
}

export async function verifyAccountOtpEmailOrPhone(req: Request, res: Response) {
   const { path } = res.locals.sessionOptions
   const user = req.user as ISessionUser;
   const { otp } = req.body;

   const updateToken = req.cookies[COOKIE_KEYS.UPDATE_TOKEN];
   if (!updateToken) {
      throw new ApiError(
         400,
         'OTP session not found. Please request a new OTP and try again.',
      );
   }
   const { verificationField, verificationValue, verificationFlag } =
      decodeJwtToken<PayloadType>(updateToken).data;
   if (!otp) {
      throw new ApiError(400, 'Otp is manditory');
   }

   const dbUser = await User.findById(user._id);
   const isOtpValid = await dbUser.verifyOtp(otp, verificationFlag);
   if (!isOtpValid) {
      throw new ApiError(
         401,
         'Otp is invalid..',
         null,
         errorKeysGenerator(401, 'INVALID_OTP'),
      );
   }
   dbUser[verificationField] = verificationValue;
   await dbUser.save();
   cookieHelper.clearCookie(res, { key: COOKIE_KEYS.UPDATE_TOKEN, path })
   return sendApiResponseHelper(res, { message: 'Your otp is verified succesfully' })
}

export async function updateAccountPassword(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser
   const { currentPassword, newPassword, revokeAllSession = false } = req.body;

   // const revokeAllSession = deleteAllSessions === "true"


   if (!currentPassword || !newPassword) {
      throw new ApiError(400, 'current and new password is mandatory')
   }
   if (!passwordRegex.test(newPassword)) {
      throw new ApiError(400, 'New password must be at 8-15 characters, including an uppercase letter, lowercase letter, number, and special character (@.#$!%*?&)—no spaces.',
      )
   }
   const filter: Record<string, unknown> = { userId: String(user._id) }
   if (revokeAllSession) {
      filter._id = { $ne: req.sessionID };
   }
   try {
      const dbUser = await User.findOne({ _id: user._id });
      if (!dbUser) {
         throw new ApiError(500, 'something went wrong with the server');
      }
      if (!dbUser.compareBcryptPassword(currentPassword)) {
         throw new ApiError(409, 'Invalid current password.');
      }
      await Promise.all([
         dbUser.updatePassword(newPassword),
         SessionStore.deleteMany(filter),
      ]);

      console.log(`[PROC] All session destroyed for user : ${user._id}`);
      console.log(`Reason changing password from inside`);

      res.status(200).json(
         new ApiResponse(200, 'Password updated successfully.'),
      );
   } catch (err) {
      console.log(err)
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

export async function updateAccountBio(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;

   const { bio, languages, profilePicture }: { bio: string; languages: string[], profilePicture: string } = req.body;

   try {

      if (!bio || !(languages && Array.isArray(languages))) {
         throw new ApiError(
            400,
            'Invalid inputs please provide valid bio and profilePicture in string languages in array format. ',
         );
      }

      if (profilePicture) {
         confirmUploadResources(profilePicture)
      }

      const updatedUser = await User.findOneAndUpdate(
         { _id: user._id },
         { languages, bio, profilePicture },
      ).select('_id');

      if (!updatedUser) {
         throw new ApiError(400, 'No user found to update profile');
      }

      return res.json(
         new ApiResponse(200, 'User Bio updated Successfully'),
      );
   } catch (err) {
      return next(err);
   }
}
