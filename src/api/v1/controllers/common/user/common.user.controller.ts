import { Response, Request, NextFunction } from 'express';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import passport from 'passport';
import { generateTokenWithExp } from '../../../utils/security/security.utils';
import { User } from '../../../models/user/user';
import {
   createDbSessionAndSetCookie,
   PayloadType,
} from './utils/common.user.utils';
import { notifyUserSwitch } from './utils/common.user.utils';
import { decodeJwtToken } from './utils/common.user.utils';
import { clearCookies } from '../../../utils/cookies/cookies.utils';
import { createJwtSession } from './utils/common.user.utils';
import { cookiePathAndNameGenerator } from '../../../utils/cookies/cookies.utils';
import { mongoStoreSession } from '../../../../../server';
import { PhoneType, sendOtpRequestType } from './utils/common.user.type';
import { IUser } from '../../../models/user/types/user.model.types';

export async function sendOtpToEmail(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   //specify type where otp request goes to  forget or signup form
   const { criteria, email, phone, type } = req.body as sendOtpRequestType;
   const { role } = cookiePathAndNameGenerator(req.baseUrl);
   const isEmail = criteria === 'EMAIL';
   const verificationField = isEmail ? 'email' : 'phone';
   const verificationValue = isEmail ? email : phone;
   const verificationFlag: 'hasEmailVerified' | 'hasPhoneVerified' = isEmail
      ? 'hasEmailVerified'
      : 'hasPhoneVerified';
   const payLoad = {
      verificationField,
      verificationValue,
      verificationFlag,
      type,
   };
   const query = isEmail
      ? {
           email: { $regex: new RegExp(`^${email}$`, 'i') },
           provider: 'local',
           role: { $in: [role] },
        }
      : {
           'phone.number': phone.number,
           provider: 'local',
           role: { $in: [role] },
        };
   try {
      let user = await User.findOne(query);

      if (!user?.hasBasicDetails && type == 'FORGET_PASSWORD_OTP') {
         throw new ApiError(
            404,
            'User not found. Please register before proceeding.',
            { step: 'login' },
         );
      }
      if (user) {
         if (
            !user[verificationFlag] ||
            (user?.hasBasicDetails && type == 'FORGET_PASSWORD_OTP')
         ) {
            const sessionData = await createDbSessionAndSetCookie(
               user,
               res,
               'otpsessionid',
               '15m',
               { userId: user._id, ...payLoad },
               req.baseUrl,
            );

            await notifyUserSwitch(
               criteria,
               type,
               { otp: sessionData.otp },
               isEmail ? email : phone.number,
            );
            res.status(200).json(
               new ApiResponse(200, 'OTP sent successfully.', {
                  step: 'verify-otp',
                  emailOtp: sessionData.otp,
               }),
            );
            return;
         }

         if (!user?.hasBasicDetails) {
            const otpSessionValidity = decodeJwtToken<{
               verificationField?: string;
            }>(req.cookies['verification-session']);
            const isSameUser =
               otpSessionValidity.data?.[verificationField] ===
               (verificationField === 'email' ? email?.trim() : phone.number);
            if (!otpSessionValidity.data || !isSameUser) {
               const sessionData = await createDbSessionAndSetCookie(
                  user,
                  res,
                  'otpsessionid',
                  '15m',
                  { userId: user._id, ...payLoad },

                  req.baseUrl,
               );
               user[verificationFlag] = false;
               await notifyUserSwitch(
                  criteria,
                  type,
                  { otp: sessionData.otp },
                  isEmail ? email : phone.number,
               );
               clearCookies(res, req.baseUrl, 'profilesessionid');

               await user.save();
               throw new ApiError(400, 'otp session expired resending otp...', {
                  step: 'verify-otp',
               });
            }
            createJwtSession(res, 'profilesessionid', '15m', req.baseUrl, {
               userId: user._id,
               verificationFlag,
            });
            //redirect in the future
            //sign up form
            throw new ApiError(
               200,
               `Your ${verificationField} is already verified. Please complete your profile to proceed.`,
               {
                  step: 'submit-profile',
               },
            );
         }
         //clear out trash cookies if any
         clearCookies(res, req.baseUrl, ...Object.keys(req.cookies));
         throw new ApiError(
            409,
            `This ${verificationField} is already verified and registered. Please log in to continue.`,
            {
               step: 'login',
            },
         );
      }

      if (role === 'admin' || role === 'host') {
         throw new ApiError(
            401,
            `Unauthorized action. You do not have the required permissions to create an ${role} account. Please contact a system administrator for access.`,
         );
      }
      // Create a new user if not found
      user = new User({
         [verificationField]: verificationValue,
         [verificationFlag]: false,
         role: [role],
      });
      const sessionData = await createDbSessionAndSetCookie(
         user,
         res,
         'otpsessionid',
         '15m',
         { userId: user._id, ...payLoad },
         req.baseUrl,
      );
      await notifyUserSwitch(
         criteria,
         type,
         { otp: sessionData.otp },
         isEmail ? email : phone.number,
      );
      await user.save();
      res.status(200).json(
         new ApiResponse(200, 'OTP sent successfully.', {
            step: 'verify-otp',
            emailOtp: sessionData.otp,
         }),
      );

      return;
   } catch (error) {
      next(error);
   }
}

export async function verifyUserOtp(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { otp } = req.body;

   try {
      const otpsessionIdToken = req.cookies['otpsessionid'];
      if (!otpsessionIdToken) {
         res.status(400).json({
            message:
               'Your otp verification session has been expired please generate new otp.',
            success: false,
            data: { step: 'login' },
         });
         return;
      }
      const {
         userId,
         verificationField,
         verificationValue,
         verificationFlag,
         type,
      } = decodeJwtToken<PayloadType>(otpsessionIdToken).data;

      const user = await User.findById(userId);

      const isOtpValid = await user.verifyOtp(otp, verificationFlag);
      if (!isOtpValid) {
         throw new ApiError(400, 'Otp is invalid..', { step: 'retry' });
      }
      user[verificationField] = verificationValue;
      await user.save();
      clearCookies(res, req.baseUrl, 'otpsessionid');
      createJwtSession(res, 'verification-session', '10m', req.baseUrl, {
         [verificationField]:
            verificationField === 'email'
               ? verificationValue
               : (verificationValue as PhoneType)?.number,
      });

      createJwtSession(res, 'profilesessionid', '10m', req.baseUrl, {
         userId,
         verificationFlag,
      });
      //sign up form
      res.status(200).json(
         new ApiResponse(200, 'OTP successfully verified.', {
            step: type == 'SIGN_UP_OTP' ? 'submit-profile' : 'change-password',
         }),
      );
   } catch (err) {
      next(err);
   }
}

export async function userChangePassword(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { password } = req.body;
   try {
      const profilesessionIdToken = req.cookies['profilesessionid'];
      const { userId } = decodeJwtToken<PayloadType>(
         profilesessionIdToken,
      ).data;

      if (!profilesessionIdToken) {
         throw new ApiError(400, 'No active session found for profile');
      }

      const user = await User.findById(userId);

      if (!user) {
         throw new ApiError(
            404,
            'Account not found. Please register to create an account.',
            { step: 'login' },
         );
      }
      if (!user.hasBasicDetails) {
         throw new ApiError(
            400,
            'Please complete your profile before changing your password.',
            { step: 'login' },
         );
      }
      user.password = password;

      await user.save();

      clearCookies(res, req.baseUrl, ...Object.keys(req.cookies));

      res.status(200).json(
         new ApiResponse(200, 'Password successfully changed.', {
            step: 'login',
         }),
      );
   } catch (err) {
      console.log(err);
      next(err);
      return;
   }
}

export const userLogout = async (
   req: Request,
   res: Response,
   next: NextFunction,
) => {
   //destroy session by session id
   const sessionId = req.sessionID;
   const { sessionName } = cookiePathAndNameGenerator(req.baseUrl);

   req.logout((err) => {
      if (err) return next(err);
      // Destroy session from MongoStore
      mongoStoreSession.destroy(sessionId, (err) => {
         if (err) return next(err);

         // Destroy the session
         req.session.destroy((err) => {
            if (err) return next(err);
            clearCookies(res, req.baseUrl, sessionName);
            return res.status(200).json({
               success: true,
               message: 'Logout successful.',
            });
         });
      });
   });
};

export const googleCallback = (req: Request, res: Response) => {
   const user = req.user;

   if (!user) {
      return res.status(400).json({
         status: false,
         message: 'Authentication failed',
      });
   }
   const payload = generateTokenWithExp('365d');
   req.session['csrf'] = payload.token;
   return res.redirect(
      `${process.env.CLIENT_URL}?token=${JSON.stringify(payload)}`,
   );
};

export const userLogin = async (
   req: Request,
   res: Response,
   next: NextFunction,
): Promise<void> => {
   const clientType = req.headers?.['client-type'];
   try {
      const payloadToSend: Partial<{
         sessionPayload: string;
         sessionId: string;
      }> = {};
      passport.authenticate('local', async (err, user: IUser, info) => {
         if (err) {
            return next(err);
         }
         if (!user) {
            next(new ApiError(400, info.message));
         }
         try {
            req.logIn(user, async (loginErr) => {
               if (loginErr) {
                  next(loginErr);
                  return;
               }

               const dbUser = await User.findById(user._id);
               const isActive = dbUser.isSoftDelete;
               if (isActive) {
                  dbUser.isSoftDelete = false;
                  await dbUser.save();
               }
               if (!clientType) {
                  const payload = generateTokenWithExp('365d');
                  req.session['csrf'] = payload.token;
                  payloadToSend.sessionPayload = JSON.stringify(payload);
               } else {
                  payloadToSend.sessionId = req.sessionID;
               }
               res.status(200).json(
                  new ApiResponse(
                     200,
                     `Logged in successfully.${isActive ? ' Your account activated again.' : ''}`,
                     {
                        role: user.role,
                        ...payloadToSend,
                        step: 'dashboard',
                     },
                  ),
               );
            });
         } catch (err) {
            next(err);
         }
      })(req, res, next);
   } catch (err) {
      console.log(err);
      next(err);
   }
};
