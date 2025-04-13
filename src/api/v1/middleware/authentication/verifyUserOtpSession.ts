import { Request, Response, NextFunction } from 'express';
import { User } from '../../models/user/user';
import { ApiError } from '../../utils/error-handlers/ApiError';
import {
   decodeJwtToken,
   PayloadType,
} from '../../controllers/common/user/utils/common.user.utils';
export async function verifyUserOtpSession(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const otpsessionIdToken = req.cookies?.['otpsessionid'];

   try {
      if (!otpsessionIdToken) {
         throw new ApiError(400, 'OTP session ID is missing.');
      }
      const decodedDataFromSession =
         decodeJwtToken<PayloadType>(otpsessionIdToken);
      if (!decodedDataFromSession.data?.userId) {
         throw new ApiError(400, 'Invalid or expired OTP session.');
      }
      const { userId } = decodedDataFromSession.data;
      const user = await User.findById(userId).select('session');

      if (!user || !user.session) {
         throw new ApiError(400, 'No active OTP session found.');
      }

      if (user.session.otpSessionId !== otpsessionIdToken) {
         throw new ApiError(400, 'OTP session expired or mismatched.');
      }

      next();
   } catch (err) {
      next(err);
   }
}
