import { cookiePathAndNameGenerator } from "../../utils/cookies/cookies.utils";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utils/error-handlers/ApiError";
import { COOKIE_KEYS } from "../../constant/cookie.key.constant";
import { DeviceType } from "../../types/session/session";
import { decodeJwtToken } from "../../controllers/common/auth/utils/auth.utils";
import { getPassportSessionUserId } from "../authorization/utils/authorization.utils";
import { ITrackerOptions } from "../../config/session/session.helper";

export function attachSessionOptions(req: Request, res: Response, next: NextFunction) {
    const session = req.session
    const passportUser = getPassportSessionUserId(session)
    if (!passportUser) {
        res.locals.sessionOptions = Object.freeze({
            ...res.locals.sessionOptions,
            ...cookiePathAndNameGenerator(req.baseUrl),
            hasSession: false,
            isForged: false,
            role: null,
            deviceType: null,
            needsRefresh: false
        })
        return next()
    }
    //--> valid session
    const tracker = req.cookies[COOKIE_KEYS.SESSION_TRACKER]
    const clientSessionId = req.headers['x-csrf-token'] as string | undefined;
    let isSessionForged = false
    let needsRefresh = false
    const deviceType = session?.deviceType
    const role = session?.role

    if (deviceType == 'web' && role != 'admin') {
        if (tracker) {
            const { data } = decodeJwtToken<ITrackerOptions>(tracker)
            if (!data) {
                isSessionForged = true
            }
            needsRefresh = clientSessionId !== data?.csrfToken
        } else {
            isSessionForged = true
        }

    }

    const sessionOptions = cookiePathAndNameGenerator(req.baseUrl)
    const realTimeSessionOptions = {
        hasSession: true,
        isForged: isSessionForged,
        role: role || null,
        deviceType,
        needsRefresh
    }
    res.locals.sessionOptions = Object.freeze({
        ...res.locals.sessionOptions,
        ...sessionOptions,
        ...realTimeSessionOptions,
    })

    next();
}



export function validateClientSource(allowedClient: DeviceType | 'admin') {
    return (req: Request, _res: Response, next: NextFunction) => {
        const userAgent = req.headers["user-agent"] || "";
        const clientHeader = req.headers["client-type"];

        let isValid = false;

        switch (allowedClient) {
            case "mobile":
                isValid = /okhttp|reactnative/i.test(userAgent) && clientHeader === "Mobile";
                break;
            case "web":
                isValid = /mozilla|chrome|safari/i.test(userAgent) && clientHeader === "web";
                break;
            case "admin":
                isValid = clientHeader === "admin";
                break;
        }

        if (!isValid) {
            throw new ApiError(403, `Access denied: Invalid ${allowedClient} client`)
        }

        next();
    };
}
