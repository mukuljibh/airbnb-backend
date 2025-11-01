import { IUser } from "../../../models/user/types/user.model.types";
import { Request } from "express";
import { generateTokenWithExp } from "../../../utils/security/security.utils";
import { SessionStore } from "../../../models/session/SessionStore";
import { subscribeToFirebaseNotifications } from "../../../utils/firebase/firebase.utils";
import { ApiError } from "../../../utils/error-handlers/ApiError";
import { OAuth2Client } from "google-auth-library";
import env from "../../../config/env";
import { USER_STATUS } from "../../../models/user/enums/user.enum";
import { SessionRequestOrigin } from "../../../utils/cookies/cookies.utils";
import { timeUnit } from "../../../config/session/session.constant";


export async function loginRequest(
    req: Request,
    user: IUser,
    requestOrigin: SessionRequestOrigin,
): Promise<
    Partial<{
        handled: boolean;
        data: any;
        error: any;
        isActive: boolean;
        sessionMeta: { csrfToken: string }
    }>
> {
    let payloadToSend;
    const { fcmToken } = req.body
    const clientType = req.headers?.['client-type'];
    const deviceType = clientType == 'Mobile' ? 'mobile' : 'web'
    let handledObject;

    try {
        await new Promise<void>((resolve, reject) => {
            req.logIn(user, async (loginErr) => {
                if (loginErr) {
                    handledObject = { handled: false, error: loginErr };
                    reject(handledObject);
                    return;
                }

                // const dbUser = await User.findById(user._id).select('role isSoftDelete');
                const csrfToken = generateTokenWithExp(timeUnit)
                req.session['csrf'] = csrfToken.token;
                // req.session['userRole'] = dbUser.role
                req.session['deviceType'] = deviceType
                if (requestOrigin !== 'unknown') {
                    req.session['role'] = requestOrigin
                }

                if (!clientType) {
                    //store passport sessionid to retrieve session  look up when main session cookies is missing.
                    //but main valid session id is always required everytime from client to validate valid user.
                    //csrf token is passport sessionId itself.
                    const payload = csrfToken
                    payloadToSend = { sessionPayload: JSON.stringify(payload) };
                } else {
                    payloadToSend = { sessionId: csrfToken.token };
                }

                const userId = user._id
                const userRole = user.role
                handledObject = {
                    handled: true,
                    data: {
                        userId: userId,
                        role: userRole,
                        step: 'dashboard',
                        ...payloadToSend,
                    },
                    sessionMeta: {
                        csrfToken: csrfToken.token
                    }
                };

                const promises = []

                promises.push(await SessionStore.updateOne(
                    { _id: req.sessionID },
                    { $set: { userId: user._id, csrfToken: csrfToken.token } },
                ))

                if (fcmToken) {
                    req.session['fcmToken'] = fcmToken
                    promises.push(subscribeToFirebaseNotifications(fcmToken, String(userId)))
                }

                await Promise.all(promises)
                resolve();
            });
        });

        return handledObject;
    } catch (err) {
        handledObject = {
            handled: false,
            error: err,
        };
        return handledObject;
    }
}


export async function verifyGoogleToken(idToken) {
    try {
        const webClientId = env.GOOGLE_CLIENT_ID
        const client = new OAuth2Client(webClientId);
        const ticket = await client.verifyIdToken({
            idToken,
            audience: webClientId,
        });

        const payload = ticket.getPayload();
        return {
            googleId: payload.sub,
            firstName: payload.given_name,
            lastName: payload.family_name,
            email: payload.email,
            hasEmailVerified: payload.email_verified,
            hasBasicDetails: true,
            status: USER_STATUS.ACTIVE,
            provider: 'google',
        };
    } catch (err) {
        throw new ApiError(400, 'Provide google OAuth token is not valid.', err);
    }
}