import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../utils/error-handlers/ApiError';
import { ISessionUser, Role } from '../../models/user/types/user.model.types';
import { errorKeysGenerator } from '../../utils/error-key-generator/errorKeys.utils';
import { User } from '../../models/user/user';
import { hasRole } from './utils/authorization.utils';
import { getPassportSessionUserId } from './utils/authorization.utils';
import { destroyPassportSession } from './utils/authorization.utils';
import env from '../../config/env';
import { cookieHelper } from '../../helper/cookies/cookies.helper';
import { COOKIE_KEYS } from '../../constant/cookie.key.constant';
import { logger, logObject } from '../../config/logger/logger';


export default function verifyRoutesAndAuthorizedRoles(
   ...allowedRoles: Role[]
) {
   return async (req: Request, res: Response, next: NextFunction) => {
      const sessionUser = req.user as ISessionUser;
      const { requestOrigin, isForged } = res.locals.sessionOptions
      const errorPayload = requestOrigin === "host"
         ? { redirect: true, location: env.GUEST_URL }
         : null;

      const passportUserId = getPassportSessionUserId(req.session);
      // when req.user is empty, req.isAuthenticated() will return false.
      //from main server entry point when csrf token mismatch req.user is clearing out from there.
      if (!req.isAuthenticated()) {
         logger.warn(
            `[PROC] Unauthorized access attempt - user: ${passportUserId || 'unknown'}, ${passportUserId ? 'CSRF mismatch' : 'no user identified'}`,
            'authMiddleware'
         );

         if (passportUserId) {
            //clearing cookie from client device as well destroy session from the db store
            // if (requestOrigin == 'admin') {
            //    await destroyPassportSession(req, res, passportUserId);
            // }
            logObject({ userAgent: req.headers['user-agent'] }, 'authMiddleware');
            throw new ApiError(401, 'Session could not be verified. Please refresh the page or log in again.', errorPayload);
         }

         throw new ApiError(
            401,
            'Authentication required. Please log in.',
            errorPayload,
            { ...errorKeysGenerator(401, 'TOKEN_EXPIRED') },
         );
      }

      if (isForged) {
         logger.warn("[SECURITY][FORGERY] Forgery detected .", 'authMiddleware');
         const { path } = res.locals.sessionOptions
         await destroyPassportSession(req, res)
         throw new ApiError(409, 'Session forgery detected. The session has been terminated.', errorPayload)
      }

      const user = await User.findById(sessionUser?._id).select('role');
      if (!user) {
         logger.warn("[SECURITY] User session detected but no corresponding user record in database.", 'authMiddleware');
         await destroyPassportSession(req, res);
         throw new ApiError(
            401,
            'Authentication failed. Please log in again.',
            errorPayload,
            errorKeysGenerator(401, 'TOKEN_EXPIRED'),
         );
      }
      if (!hasRole(user, allowedRoles)) {
         logger.warn(
            `[SECURITY] Access denied for user ${user._id}. Required roles: ${allowedRoles.join(", ")}, found: ${user.role}`,
            'authMiddleware'
         );
         throw new ApiError(403, 'Access denied: insufficient permissions.', errorPayload);
      }

      return next();

   };
}
