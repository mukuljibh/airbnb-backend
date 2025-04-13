import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../utils/error-handlers/ApiError';
export function verifyProfileSession(sessionId: string) {
   return async function verifyToken(
      req: Request,
      res: Response,
      next: NextFunction,
   ) {
      try {
         const profilesessionid = req.cookies?.[sessionId];
         if (!profilesessionid) {
            throw new ApiError(400, 'No Profile session token found');
         }
         jwt.verify(
            profilesessionid,
            process.env.ACCESS_TOKEN_KEY,
            function (err) {
               if (err) {
                  console.error('JWT verification error:', err);
                  throw new ApiError(400, 'Session expired.');
               }
               next();
            },
         );
      } catch (err) {
         next(err);
      }
   };
}
