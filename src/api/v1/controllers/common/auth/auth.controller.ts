import { Request, Response, NextFunction } from "express";
import { IUser } from "../../../models/user/types/user.model.types";
import passport from "passport";
import { ApiError } from "../../../utils/error-handlers/ApiError";
import { USER_STATUS } from "../../../models/user/enums/user.enum";
import { createDbSessionAndSetCookie, createJwtSession, decodeJwtToken, notifyUserSwitch, PayloadType } from "./utils/auth.utils";
import { reopenUserAccountBySystem } from "../user/services/account.service";
import { ApiResponse } from "../../../utils/error-handlers/ApiResponse";
import { loginRequest, verifyGoogleToken } from "./auth.service";
import { destroyPassportSession } from "../../../middleware/authorization/utils/authorization.utils";
import { unsubscribeToFirebaseNotifications } from "../../../utils/firebase/firebase.utils";
import { User } from "../../../models/user/user";
import { PhoneType, sendOtpRequestType } from "./types/auth.types";
import { parse } from "date-fns";
import { createRecipient, dispatchNotification } from "../notifications/services/dispatch.service";
import { cookieHelper } from "../../../helper/cookies/cookies.helper";
import { COOKIE_KEYS } from "../../../constant/cookie.key.constant";

export async function userLogin(req: Request, res: Response, next: NextFunction) {
    try {
        const { requestOrigin } = res.locals.sessionOptions
        passport.authenticate('local', async (err, user: IUser, info) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                return next(new ApiError(400, info.message));
            }
            try {

                const status = user.status

                if (status === USER_STATUS.DELETED) {
                    throw new ApiError(409, 'Your account has been permanently deleted and can no longer be accessed.');
                }

                if (status === USER_STATUS.PENDING_DELETION) {
                    await reopenUserAccountBySystem({ userId: user._id })
                }

                const { handled, error, data } = await loginRequest(
                    req,
                    user,
                    requestOrigin,

                );
                if (!handled) {
                    throw error?.['error'];
                }

                return res.json(
                    new ApiResponse(
                        200,
                        'Welcome back! You have successfully logged in.',
                        { ...data, viewAs: requestOrigin },
                    ),
                );
            } catch (err) {
                next(err);
            }
        })(req, res, next);

    } catch (err) {
        console.log(err);
        next(err);
    }
};

export async function googleLogin(req: Request, res: Response) {
    let user: IUser;
    const { requestOrigin: currentPanel } = res.locals.sessionOptions
    const { idToken } = req.body;

    const userData = await verifyGoogleToken(idToken);
    user = await User.findOne({ email: userData.email, });

    if (!user) {
        user = new User(userData);
        await user.save();
    } else {

        if (!user.googleId)
            await User.updateOne({ _id: user._id }, {
                $set: {
                    googleId: userData.googleId,
                },
            });
    }
    const userRole = user.role;
    const status = user.status

    if (status === USER_STATUS.DELETED) {
        throw new ApiError(409, 'Your account has been permanently deleted and can no longer be accessed.');
    }


    if (status === USER_STATUS.PENDING_DELETION) {
        await reopenUserAccountBySystem({ status, userId: user._id })
    }

    if (currentPanel === 'host' && !userRole.includes('host')) {
        throw new ApiError(
            409,
            'Your account does not have access to the host panel. Please register as a host on the main website.'
        );
    }

    const { handled, error, data } = await loginRequest(req, user, currentPanel);

    if (!handled) {
        throw error?.['error'];
    }

    return res.json(
        new ApiResponse(
            200,
            'Welcome back! You have successfully logged in with Google.',
            data,
        ),
    );

}


export const userLogout = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const user = req.user;
    const userId = String(user._id);

    const fcmToken = req.session?.fcmToken
    // const sessionRole = req.session?.role
    // const deviceType = req.session?.deviceType

    req.logout(async (err) => {
        if (err) return next(err);
        try {
            // Destroy session from store
            console.log(`[PROC] Logout user: ${userId}`);
            await destroyPassportSession(req, res, userId);
            if (fcmToken) {
                unsubscribeToFirebaseNotifications(fcmToken, userId)
            }
            return res.json(new ApiResponse(200, 'Logout successful.'));
        } catch (err) {
            console.error('Error destroying session during Logout:', err);
            return next(err);
        }
    });
};


export async function userChangePassword(req: Request, res: Response) {
    const { cookieScope: path } = res.locals.sessionOptions
    const { password } = req.body;
    const profileToken = req.cookies[COOKIE_KEYS.PROFILE_SESSION_ID];
    const { data } = decodeJwtToken<PayloadType>(profileToken)

    if (!data) throw new ApiError(400, 'Your session has expired. Please place new request to change your password.')

    const { userId } = data
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(
            404,
            'We couldn’t find your account. Please sign up to create one',
            { step: 'login' },
        );
    }

    if (!user.hasBasicDetails) {
        throw new ApiError(
            400,
            'Please complete your profile before setting a new password.',
            { step: 'login' },
        );
    }

    await user.updatePassword(password);

    const cookiesKeysToRemove = [COOKIE_KEYS.PROFILE_SESSION_ID, COOKIE_KEYS.VERIFICATION_SESSION_ID]
    cookiesKeysToRemove.forEach((key) => { cookieHelper.clearCookie(res, { key, path }) })

    res.json(
        new ApiResponse(200, 'Your password has been updated successfully.', {
            step: 'login',
        }),
    );

}



export async function handleSendOtp(req: Request, res: Response) {
    //specify type where otp request goes to  forget or signup form
    const { cookieScope: path } = res.locals.sessionOptions
    const { criteria, email, phone, type } = req.body as sendOtpRequestType;
    const { requestOrigin } = res.locals.sessionOptions
    const isEmail = criteria === 'EMAIL';
    const verificationField = isEmail ? 'email' : 'phone';
    const verificationValue = isEmail ? email : phone;
    const verificationFlag: 'hasEmailVerified' | 'hasPhoneVerified' = isEmail
        ? 'hasEmailVerified'
        : 'hasPhoneVerified';
    const payLoad = {
        verificationField,
        verificationValue,
        verificationFlag,
        type,
    };

    const query = isEmail
        ? {
            email,
            //   provider: 'local',
            role: { $in: [requestOrigin] },
        }
        : {
            'phone.number': phone.number,
            //   provider: 'local',
            role: { $in: [requestOrigin] },
        };

    let user = await User.findOne(query);

    if (!user?.hasBasicDetails && type == 'FORGET_PASSWORD_OTP') {
        throw new ApiError(
            404,
            'We couldn’t find an account with those details. Please sign up first.',
            { step: 'login' },
        );
    }
    if (user) {
        if (
            !user[verificationFlag] ||
            (user?.hasBasicDetails && type == 'FORGET_PASSWORD_OTP')
        ) {
            const sessionData = await createDbSessionAndSetCookie(
                user,
                res,
                COOKIE_KEYS.OTP_SESSION_ID,
                '15m',
                { userId: user._id, ...payLoad },
                req.baseUrl,
            );

            notifyUserSwitch(
                criteria,
                type,
                { otp: sessionData.otp, name: email },
                isEmail ? email : phone.number,
            );
            return res.json(
                new ApiResponse(200, 'OTP sent successfully.', {
                    step: 'verify-otp',
                    emailOtp: sessionData.otp,
                }),
            );
            ;
        }

        if (!user?.hasBasicDetails) {
            const otpSessionValidity = decodeJwtToken<{
                verificationField?: string;
            }>(req.cookies[COOKIE_KEYS.VERIFICATION_SESSION_ID]);
            const isSameUser =
                otpSessionValidity.data?.[verificationField] ===
                (verificationField === 'email' ? email?.trim() : phone.number);
            if (!otpSessionValidity.data || !isSameUser) {
                const sessionData = await createDbSessionAndSetCookie(
                    user,
                    res,
                    COOKIE_KEYS.OTP_SESSION_ID,
                    '15m',
                    { userId: user._id, ...payLoad },

                    req.baseUrl,
                );
                user[verificationFlag] = false;
                notifyUserSwitch(
                    criteria,
                    type,
                    { otp: sessionData.otp, name: email },
                    isEmail ? email : phone.number,
                );

                cookieHelper.clearCookie(res, { key: COOKIE_KEYS.PROFILE_SESSION_ID, path })

                await user.save();
                return res.json(
                    new ApiResponse(200, 'Your OTP session expired. We’ve sent you a new code.', {
                        step: 'verify-otp',
                    }),
                );
            }
            createJwtSession(res, COOKIE_KEYS.PROFILE_SESSION_ID, '15m', req.baseUrl, {
                userId: user._id,
                verificationFlag,
            });
            //redirect in the future
            //sign up form
            throw new ApiError(
                200,
                `Your ${verificationField} is already verified. Please complete your profile to continue.`,
                {
                    step: 'submit-profile',
                },
            );
        }
        //clear out trash cookies if any
        Object.keys(req.cookies).forEach((cookieKey) => {
            cookieHelper.clearCookie(res, { key: cookieKey, path })
        })

        const isPasswordlessLogin = Boolean(!user?.password);
        throw new ApiError(
            409,
            `This ${verificationField} is already linked to an account. Please log in to continue.`,
            {
                step: 'login',
                isPasswordlessLogin,
            },
        );
    }

    if (requestOrigin === 'admin' || requestOrigin === 'host') {
        throw new ApiError(
            401,
            `You don’t have permission to create an ${requestOrigin} account. Please contact support if you think this is a mistake.`,
        );
    }
    // Create a new user if not found
    user = new User({
        [verificationField]: verificationValue,
        [verificationFlag]: false,
        role: [requestOrigin],
    });
    const sessionData = await createDbSessionAndSetCookie(
        user,
        res,
        COOKIE_KEYS.OTP_SESSION_ID,
        '15m',
        { userId: user._id, ...payLoad },
        req.baseUrl,
    );
    notifyUserSwitch(
        criteria,
        type,
        { otp: sessionData.otp, name: email },
        isEmail ? email : phone.number,
    );
    await user.save();
    return res.json(
        new ApiResponse(200, 'We’ve sent you a verification code.', {
            step: 'verify-otp',
            emailOtp: sessionData.otp,
        }),
    );


}

export async function verifyUserOtp(
    req: Request,
    res: Response,
) {
    const { otp } = req.body;
    const otpToken = req.cookies[COOKIE_KEYS.OTP_SESSION_ID];
    const { data } = decodeJwtToken<PayloadType>(otpToken)

    if (!data) throw new ApiError(400, 'Your session has expired. Please request a new OTP.', { step: 'login' })

    const {
        userId,
        verificationField,
        verificationValue,
        verificationFlag,
        type,
    } = data;

    const user = await User.findById(userId);

    const isOtpValid = await user.verifyOtp(otp, verificationFlag);
    if (!isOtpValid) {
        throw new ApiError(400, 'The OTP you entered is incorrect. Please try again.', { step: 'retry' });
    }
    user[verificationField] = verificationValue;

    const { cookieScope: path } = res.locals.sessionOptions
    //clearing cookies
    cookieHelper.clearCookie(res, { key: COOKIE_KEYS.OTP_SESSION_ID, path })

    createJwtSession(res, COOKIE_KEYS.VERIFICATION_SESSION_ID, '10m', req.baseUrl, {
        [verificationField]:
            verificationField === 'email'
                ? verificationValue
                : (verificationValue as PhoneType)?.number,
    });

    createJwtSession(res, COOKIE_KEYS.PROFILE_SESSION_ID, '10m', req.baseUrl, {
        userId,
        verificationFlag,
    });

    await user.save();

    res.json(
        new ApiResponse(200, 'Your OTP has been verified successfully!', {
            step: type == 'SIGN_UP_OTP' ? 'submit-profile' : 'change-password',
        }),
    );

}



export async function submitProfileDetails(req: Request, res: Response) {
    const { firstName, lastName, dob, password, contactEmail } = req.body;
    const profileToken = req.cookies[COOKIE_KEYS.PROFILE_SESSION_ID];
    const { data } = decodeJwtToken<PayloadType>(profileToken)
    if (!data) throw new ApiError(400, 'Your session has expired. Please log in again.', { step: 'login' })

    const { userId, verificationFlag } = data

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(
            401,
            'We couldn’t find your account. Please sign up to continue.',
            { step: 'login' },
        );
    }

    const isOtpVerified = user[verificationFlag]

    if (!isOtpVerified) {
        throw new ApiError(401, `Please verify your email or phone number to continue.`, {
            step: 'verify-otp',
        });
    }
    const hasUserAlreadyVerified = user.hasBasicDetails

    if (hasUserAlreadyVerified) {
        throw new ApiError(
            403,
            'Profile details have already been completed.',
            { step: 'login' },
        );
    }

    Object.assign(user, {
        firstName,
        lastName,
        dob: parse(dob, 'dd-MM-yyyy', new Date()),
        password,
        hasBasicDetails: true,
        contactEmail,
        status: USER_STATUS.ACTIVE
    });
    await user.save();

    const { cookieScope: path } = res.locals.sessionOptions

    Object.keys(req.cookies).forEach((cookieKey) => {
        cookieHelper.clearCookie(res, { key: cookieKey, path })
    })

    const payload = createRecipient('both', {
        emailOptions: {
            type: 'WELCOME',
            destination: user?.email || user?.contactEmail,
            replacement: { name: `${user.firstName} ${user.lastName}` },
        },
        notificationOptions: {
            userId: String(user._id),
            title: 'Welcome to Airbnb!',
            message: 'Thanks for signing up. Start exploring unforgettable stays.',
            visibleToRoles: ['guest'],
            redirectKey: null,
            metadata: null,
        }
    })
    dispatchNotification({ recipients: [payload] });
    return res.json(
        new ApiResponse(201, 'Profile created successfully!', {
            step: 'login',
        }),
    );
} 
