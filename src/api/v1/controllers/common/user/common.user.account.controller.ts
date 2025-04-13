import { omitBy, isUndefined } from 'lodash';
//--------------------------------------------------Secure account settings controllers-------------------------------------------------------

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import {
   CriteriaType,
   OperationType,
   PhoneType,
} from './utils/common.user.type';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { User } from '../../../models/user/user';
import {
   decodeJwtToken,
   notifyUserSwitch,
   createDbSessionAndSetCookie,
   PayloadType,
} from './utils/common.user.utils';
import { passwordRegix } from '../../../utils/regex/regex.constant';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { clearCookies } from '../../../utils/cookies/cookies.utils';
import { errorKeysGenerator } from '../../../utils/error-key-generator/errorKeys.utils';
import { BankDetails } from '../../../models/user/bankDetails';
import { Notification } from '../../../models/notification/notification';
export async function getUserAccountProfile(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   try {
      const [result, bankDetails, hasNotifications] = await Promise.all([
         User.findOne({ _id: user?._id })
            .select(
               'firstName lastName email phone address bio role language profilePicture hasEmailVerified hasPhoneVerified verification',
            )
            .lean(),
         BankDetails.findOne({
            userId: user._id,
         }).lean(),
         Notification.findOne({ userId: user._id, isRead: false }).select(
            '_id',
         ),
      ]);

      res.status(200).json(
         new ApiResponse(
            200,
            'User profile information fetched successfully.',
            {
               ...result,
               hasNotifications: !!hasNotifications,
               bankDetails,
            },
         ),
      );
   } catch (err) {
      next(err);
   }
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
         'updateToken',
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
      next(err);
   }
}

export async function verifyAccountOtpEmailOrPhone(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const user = req.user as ISessionUser;
   const { otp } = req.body;
   try {
      const updateToken = req.cookies?.['updateToken'];
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
      clearCookies(res, req.baseUrl, 'updateToken');
      res.status(200).json(
         new ApiResponse(200, 'Your otp is verified succesfully'),
      );
   } catch (err) {
      next(err);
   }
}

export async function updateAccountPassword(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { currentPassword, newPassword } = req.body;
   try {
      if (!currentPassword || !newPassword) {
         throw new ApiError(400, 'current and new password is mandatory');
      }
      if (!passwordRegix.test(newPassword)) {
         throw new ApiError(
            400,
            'New password must be at 8-15 characters, including an uppercase letter, lowercase letter, number, and special character (@.#$!%*?&)—no spaces.',
         );
      }

      const user = req.user as ISessionUser;
      const dbUser = await User.findOne({ _id: user._id });
      if (!dbUser) {
         throw new ApiError(500, 'something went wrong with the server');
      }
      if (!dbUser.compareBcryptPassword(currentPassword)) {
         throw new ApiError(400, 'Invalid current password.');
      }
      await dbUser.updatePassword(newPassword);

      res.status(200).json(
         new ApiResponse(200, 'Password updated successfully.'),
      );
   } catch (err) {
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

   const { bio, languages }: { bio: string; languages: string[] } = req.body;
   try {
      if (!bio || !(languages && Array.isArray(languages))) {
         throw new ApiError(
            400,
            'Invalid inputs please provide valid bio in string and languages in array format.',
         );
      }
      const updatedUser = await User.findOneAndUpdate(
         { _id: user._id },
         { languages, bio },
      ).select('bio languages name');
      if (!updatedUser) {
         throw new ApiError(400, 'No user found to update profile');
      }

      res.status(200).json(
         new ApiResponse(200, 'User bio updated Successfully'),
      );
   } catch (err) {
      next(err);
   }
}
