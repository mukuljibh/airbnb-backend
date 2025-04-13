import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../utils/error-handlers/ApiError';
import { ISessionUser, Role } from '../../models/user/types/user.model.types';
import { verifyCsrf } from './utils/verifyCsrf';
import { errorKeysGenerator } from '../../utils/error-key-generator/errorKeys.utils';
import { IUser } from '../../models/user/types/user.model.types';
import { User } from '../../models/user/user';
function hasRole(user: IUser, allowedRoles: Role[]): boolean {
   return user.role.some((role) =>
      allowedRoles.includes(role.toLowerCase() as Role),
   );
}

export default function verifyRoutesAndAuthorizedRoles(
   ...allowedRoles: Role[]
) {
   return async (req: Request, res: Response, next: NextFunction) => {
      const sessionUser = req.user as ISessionUser;
      const user = await User.findById(sessionUser?._id).select('role');
      try {
         if (!user || !req.isAuthenticated()) {
            throw new ApiError(
               401,
               'Authentication required Please login.',
               null,
               errorKeysGenerator(401, 'TOKEN_EXPIRED'),
            );
         }
         if (!hasRole(user, allowedRoles)) {
            throw new ApiError(403, 'Access denied: insufficient permissions.');
         }
         // csrf security only applicable to web application
         verifyCsrf(req);

         return next();
      } catch (err) {
         next(err);
      }
   };
}
