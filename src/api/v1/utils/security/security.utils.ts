import crypto from 'crypto';

import { ExpirationProps } from '../dates/dates.types';
import { generateExpTime } from '../dates/dates.utils';

// export function generateTokenWithExp(exp: ExpirationProps, token, length = 32) {
//    const expirationDuration = generateExpTime(exp);

//    // return {
//    //    token: crypto.randomBytes(length).toString('hex'),
//    //    exp: expirationDuration,
//    // };

//    return {
//       token,
//       exp: expirationDuration,\
//    }
// }


export function generateTokenWithExp(exp: ExpirationProps, length = 10) {
   const expirationDuration = generateExpTime(exp);

   return {
      token: crypto.randomBytes(length).toString('hex'),
      exp: expirationDuration,
   };


}
