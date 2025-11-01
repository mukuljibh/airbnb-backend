import env from "../../../../config/env";
import { emailEmitter } from "../../../../events/email/email.emitter";
import { IUser } from "../../../../models/user/types/user.model.types";
import { MongoObjectId } from "../../../../types/mongo/mongo";
import { ExpirationProps } from "../../../../utils/dates/dates.types";
import { generateExpTime } from "../../../../utils/dates/dates.utils";
import { ApiError } from "../../../../utils/error-handlers/ApiError";
import { CriteriaType, OperationType, PhoneType } from "../types/auth.types";
import { Response } from "express";
import jwt from "jsonwebtoken"

export type PayloadType = {
    userId?: MongoObjectId;
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
    payload: {
        otp?: string;
        new_email?: string;
        old_email?: string;
        name?: string;
    },
    genricDestination: string,
) {
    switch (criteria) {
        case 'EMAIL':
            emailEmitter.emit('email:send', {
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
            env.ACCESS_TOKEN_KEY,
        );
        return verified as { data: T };
    } catch (error) {
        console.error('Error verifying or decoding token:', error);
        return { data: null };
    }
}

export function generateJwtToken<T>(exp: ExpirationProps, data?: T) {
    const token = jwt.sign({ data }, env.ACCESS_TOKEN_KEY as string, {
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
    const { cookieScope } = res.locals.sessionOptions

    const expirationDuration = generateExpTime(exp);
    res.cookie(sessionName, token, {
        expires: expirationDuration,
        httpOnly: flag || true,
        secure: env.NODE_ENV == 'production' ? true : false,
        sameSite: env.NODE_ENV == 'production' ? 'none' : 'lax',
        path: cookieScope,
    });
    return token;
}
