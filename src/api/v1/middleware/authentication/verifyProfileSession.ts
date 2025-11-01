import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../utils/error-handlers/ApiError';
import { decodeJwtToken } from '../../controllers/common/auth/utils/auth.utils';

export function verifyProfileSession(sessionKey: string) {
   return async function verifyToken(
      req: Request,
      res: Response,
      next: NextFunction,
   ) {
      const profilesessionid = req.cookies?.[sessionKey];

      const { data } = decodeJwtToken(profilesessionid)

      if (!data) {
         throw new ApiError(400, 'Your signup session has expired or is invalid. Please start again to continue.', { step: "login" });
      }

      return next();
   };
}
