import crypto from 'crypto';

import { ExpirationProps } from '../date-helper/dates.types';
import { generateExpTime } from '../date-helper/dates.utils';

export function generateTokenWithExp(exp: ExpirationProps, length = 32) {
   const expirationDuration = generateExpTime(exp);

   return {
      token: crypto.randomBytes(length).toString('hex'),
      exp: expirationDuration,
   };
}
