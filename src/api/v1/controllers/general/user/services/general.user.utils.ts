import { Response } from 'express';
import { generateExpTime } from '../../../../utils/dates/dates.utils';
import { ExpirationProps } from '../../../../utils/dates/dates.types';
import env from '../../../../config/env';

export function generateNormalCookies<T>(
   res: Response,
   sessionName: string,
   payload: T,
   exp: ExpirationProps,
   flag?: boolean,
): void {
   // Create JWT token with expiration in seconds
   const expirationDuration = generateExpTime(exp);
   res.cookie(sessionName, payload, {
      expires: expirationDuration,
      httpOnly: flag || true,
      secure: env.NODE_ENV == 'production',
      sameSite: env.NODE_ENV == 'production' ? 'none' : 'lax',
   });
}


