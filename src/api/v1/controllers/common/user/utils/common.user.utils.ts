import { IUser } from '../../../../models/user/types/user.model.types';
import { ExpirationProps } from '../../../../utils/date-helper/dates.types';
import { CriteriaType, OperationType, PhoneType } from './common.user.type';
import { ApiError } from '../../../../utils/error-handlers/ApiError';
import { generateExpTime } from '../../../../utils/date-helper/dates.utils';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { cookiePathAndNameGenerator } from '../../../../utils/cookies/cookies.utils';
import mongoose from 'mongoose';
import { userEmitter } from '../../../../events/user/user.emitter';
export type PayloadType = {
   userId?: mongoose.Types.ObjectId;
   verificationField: string;
   verificationFlag: 'hasEmailVerified' | 'hasPhoneVerified';
   verificationValue: string | PhoneType;
   type?: string;
};
export const createDbSessionAndSetCookie = async (
   user: IUser,
   res: Response,
   sessionName: string,
   exp: ExpirationProps,
   payload?: PayloadType,
   baseUrl?: string,
) => {
   const sessionId = createJwtSession(res, sessionName, exp, baseUrl, payload);
   const sessionData = await user.createSession(sessionId, payload.type);
   return sessionData;
};

export function notifyUserSwitch(
   criteria: CriteriaType,
   type: OperationType,
   payload: { otp?: string; new_email?: string; old_email?: string },
   genricDestination: string,
) {
   switch (criteria) {
      case 'EMAIL':
         userEmitter.emit('user:otpGenerated', {
            type: type,
            destination: genricDestination,
            replacement: payload,
         });
         console.log(genricDestination, payload);
         break;

      case 'PHONE':
         console.log(genricDestination, payload);
         break;

      default:
         throw new ApiError(400, 'criteria not implemented yet');
   }
}

export function decodeJwtToken<T>(token: string | undefined | null) {
   if (!token) {
      console.warn('No JWT token provided to decodeJwtToken');
      return { data: null };
   }

   try {
      const verified = jwt.verify(
         token,
         process.env.ACCESS_TOKEN_KEY as string,
      );
      return verified as { data: T };
   } catch (error) {
      console.error('Error verifying or decoding token:', error);
      return { data: null };
   }
}
export function generateJwtToken<T>(exp: ExpirationProps, data?: T) {
   const token = jwt.sign({ data }, process.env.ACCESS_TOKEN_KEY as string, {
      expiresIn: exp,
   });
   return token;
}
export function createJwtSession<T>(
   res: Response,
   sessionName: string,
   exp: ExpirationProps,
   baseUrl: string,
   data?: T,
   flag?: boolean,
): string {
   // Create JWT token with expiration in seconds
   const token = generateJwtToken(exp, data);
   const { path } = cookiePathAndNameGenerator(baseUrl);

   const expirationDuration = generateExpTime(exp);
   res.cookie(sessionName, token, {
      expires: expirationDuration,
      httpOnly: flag || true,
      secure: process.env.ENVIRONMENT === 'PROD' ? true : false,
      sameSite: process.env.ENVIRONMENT === 'PROD' ? 'none' : 'lax',
      path,
   });
   return token;
}
