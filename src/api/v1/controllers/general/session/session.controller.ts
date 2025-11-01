import { Request, Response } from "express";
import { ApiResponse } from "../../../utils/error-handlers/ApiResponse";
import { SessionStore } from "../../../models/session/SessionStore";
import { ApiError } from "../../../utils/error-handlers/ApiError";
import { generateExpTime } from "../../../utils/dates/dates.utils";
import { timeUnit } from "../../../config/session/session.constant";


export async function switchSessionRolesForNative(req: Request, res: Response) {

    const { requestOrigin } = res.locals.sessionOptions
    const user = req.user
    const sessionId = req.sessionID
    const newRole = requestOrigin == 'guest' ? 'host' : 'guest'
    const sessionStore = await SessionStore.findOne({ _id: sessionId, userId: user._id })

    if (!sessionStore) {
        throw new ApiError(401, 'Session got expired please login again')
    }

    const sessionObj = JSON.parse(sessionStore.session)

    sessionObj.role = newRole
    sessionStore.session = JSON.stringify(sessionObj)
    await sessionStore.save()

    const payload = {
        userId: user._id,
        viewAs: newRole,
    }

    return res.json(new ApiResponse(200, `Session switched to ${newRole} mode.`, payload))
}


export async function switchSessionRolesForNativeProtoType(req: Request, res: Response) {

    const { requestOrigin } = res.locals.sessionOptions
    const user = req.user
    const newRole = requestOrigin

    const payload = {
        userId: user._id,
        viewAs: newRole,
    }

    return res.json(new ApiResponse(200, `Session switched to ${newRole} mode.`, payload))
}

// export async function switchSession(req: Request, res: Response) {
//     const { role } = res.locals.sessionOptions;
//     const user = req.user;
//     const sessionId = req.sessionID;

//     const switchRole = role === "guest" ? "host" : "guest";

//     const exp = "1m";
//     const payload = { userId: user._id, sessionId, requestComesFrom: role };
//     const token = generateJwtToken(exp, payload);
//     const expirationDuration = generateExpTime(exp);

//     res.cookie(SESSION_COOKIE_KEYS.SWITCH_SESSION, token, {
//         expires: expirationDuration,
//         httpOnly: true,
//         secure: process.env.ENVIRONMENT === "PROD",
//         sameSite: process.env.ENVIRONMENT === "PROD" ? "none" : "lax",
//         path: `/api/v1/${switchRole}`,
//     });

//     const redirectUrl = role === "host" ? env.GUEST_URL : env.HOST_URL;

//     return res.json(
//         new ApiResponse(200, "Session initialized successfully.", { url: redirectUrl })
//     );
// }


// export async function validateSession(req: Request, res: Response) {

//     const user = req.user
//     const { sessionOptions } = res.locals
//     const { role } = sessionOptions

//     const expectedCookieToken = req.cookies?.[SESSION_COOKIE_KEYS.SWITCH_SESSION]

//     if (!expectedCookieToken) {
//         throw new ApiError(404, 'No valid SSO token found to proceed.')
//     }

//     const { data } = decodeJwtToken<ISwitchSession>(expectedCookieToken)

//     if (!data) {
//         throw new ApiError(409, 'SSO rejected not allowed please login in')
//     }

//     const requestComesFrom = data?.requestComesFrom

//     if (requestComesFrom == role) {
//         throw new ApiError(409, 'Not allowed')
//     }

//     res.clearCookie(SESSION_COOKIE_KEYS.SWITCH_SESSION, {
//         httpOnly: true,
//         secure: process.env.ENVIRONMENT === 'PROD' ? true : false,
//         sameSite: process.env.ENVIRONMENT === 'PROD' ? 'none' : 'lax',
//         path: `/api/v1/${role}`,
//     });
//     return res.json(
//         new ApiResponse(200, 'SSO successfully verified.',
//             { sessionId: req.sessionID, userId: user._id }))

// }



// export async function verifySSOLogin(req: Request, res: Response, next: NextFunction) {
//     const expectedCookieToken = req.cookies?.[SESSION_COOKIE_KEYS.SWITCH_SESSION]
//     if (expectedCookieToken) {
//         const { requestOrigin } = res.locals.sessionOptions
//         const { data } = decodeJwtToken<ISwitchSession>(expectedCookieToken)
//         const hasValidSSORequest = data && requestOrigin != data.requestComesFrom

//         if (hasValidSSORequest) {
//             const user = await User.findById(data.userId)
//             await loginRequest(req, user, requestOrigin)
//         }
//     }
//     return next()
// }


export async function getCurrentSessionState(req: Request, res: Response) {

    const { needsRefresh } = res.locals.sessionOptions
    const { csrf } = req.session
    const payload = {
        token: csrf,
        exp: generateExpTime(timeUnit)
    }
    const sessionPayload = JSON.stringify(payload);

    let result: Record<string, unknown> = {
        needsRefresh
    }
    if (needsRefresh) {
        result = { ...result, sessionId: csrf, step: 'dashboard', sessionPayload }
    }

    return res.json(result)

}