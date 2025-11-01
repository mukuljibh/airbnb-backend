import { Request, Response, NextFunction } from 'express';
import { User } from '../../models/user/user';
import { ApiError } from '../../utils/error-handlers/ApiError';
import {
   decodeJwtToken,
   PayloadType,
} from '../../controllers/common/auth/utils/auth.utils';
import { COOKIE_KEYS } from '../../constant/cookie.key.constant';
export async function verifyUserOtpSession(
   req: Request,
   res: Response,
   next: NextFunction,
) {

   const otpToken = req.cookies?.[COOKIE_KEYS.OTP_SESSION_ID];
   const { data } = decodeJwtToken<PayloadType>(otpToken)
   if (!data) {
      throw new ApiError(400, 'We could not find an active OTP session. Please request a new code.', { step: "login" });
   }
   const { userId } = data;

   const user = await User.findById(userId).select('session');

   if (!user) {
      throw new ApiError(404, 'We could not find an account associated with this OTP.', { step: 'login' })
   }

   const userSession = user?.session

   if (!userSession) {
      throw new ApiError(400, 'No active OTP session was found for this account. Please resend the code.', { step: "retry" });
   }

   if (userSession?.otpSessionId !== otpToken) {
      throw new ApiError(400, 'Your OTP session has expired or does not match. Please try again.', { step: "login" });
   }

   return next()
}
