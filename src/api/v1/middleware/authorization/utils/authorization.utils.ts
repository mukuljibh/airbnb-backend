import { Request, Response } from 'express';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { IUser, Role } from '../../../models/user/types/user.model.types';
import { PassportSession } from '../../../types/session/session';
import { cookieHelper } from '../../../helper/cookies/cookies.helper';

export function getClientTokenFromHeaders(req: Request) {
   return req.headers['x-csrf-token'];
}

export function validateCsrfToken(
   csrfTokenFromSession: string,
   clientCsrfTokenFromHeaders: string | string[],
) {
   if (csrfTokenFromSession != clientCsrfTokenFromHeaders) {
      throw new ApiError(401, 'CSRF token mismatch');
   }
}

export function verifyCsrf(req: Request) {
   const clientType = req.headers['client-type'];

   if (req.method === 'GET' || clientType == 'Mobile') return;
   const csrfTokenFromSession = req.session['csrf'];
   if (!csrfTokenFromSession) {
      throw new ApiError(401, 'CSRF token not found in session memory');
   }
   const clientCsrfTokenFromHeader = getClientTokenFromHeaders(req);

   if (!clientCsrfTokenFromHeader) {
      throw new ApiError(401, 'CSRF token not provided in headers');
   }
   validateCsrfToken(csrfTokenFromSession, clientCsrfTokenFromHeader);
}

export function hasRole(user: IUser, allowedRoles: Role[]): boolean {
   return user.role.some((role) =>
      allowedRoles.includes(role.toLowerCase() as Role),
   );
}

export function getPassportSessionUserId(session: Partial<PassportSession>) {
   return session?.passport?.user;
}

export async function destroyPassportSession(
   req: Request,
   res: Response,
   userId?: string,
) {
   const { path, sessionName } = res.locals.sessionOptions
   const passportUserId = getPassportSessionUserId(req.session);
   cookieHelper.clearCookie(res, { key: sessionName, path })
   await new Promise((resolve) =>
      req.session.destroy((err) => {
         if (err) console.error('Failed to destroy session:', err);
         else {
            console.log(
               `Session destroyed for user: ${passportUserId || userId}`,
            );
            resolve(null);
         }
      }),
   );
}
