import { Request } from 'express';
import { ApiError } from '../../../utils/error-handlers/ApiError';

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
