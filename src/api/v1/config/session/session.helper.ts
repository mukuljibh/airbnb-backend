import { Application } from "express"
import { COOKIE_KEYS } from "../../constant/cookie.key.constant"
import { cookieHelper } from "../../helper/cookies/cookies.helper"
import { SessionStore } from "../../models/session/SessionStore"
import { cookiePathAndNameGenerator } from "../../utils/cookies/cookies.utils"
import env from "../env"
import signature from 'cookie-signature'
import { getPassportSessionUserId } from "../../middleware/authorization/utils/authorization.utils"
import { sessions } from "./session.constant"

export const allowedOrigin = ['guest', 'host', 'admin']

export const guestHostOrigin = ['guest', 'host']

export function createAuthSessionManager(app: Application) {

    function intializeExpressSession() {

        // Admin session
        app.use(
            '/api/v1/admin',
            sessions.adminSession

        );

        //single session for guest and host
        app.use(
            '/api/v1',
            sessions.userSession

        );

        app.use(
            '/',
            sessions.globalSession
        );
    }

    function syncSessionCookie() {
        app.use(async (req, res, next) => {

            const { requestOrigin, path } = res.locals.sessionOptions

            const isValidRequestPath = allowedOrigin.includes(requestOrigin);
            if (!isValidRequestPath) return next();

            let expectedCookieKey = ''

            if (guestHostOrigin.includes(requestOrigin)) {
                expectedCookieKey = COOKIE_KEYS.GENERAL_SESSION
            }
            if (requestOrigin == "admin") {
                expectedCookieKey = COOKIE_KEYS.ADMIN_SESSION
            }

            const expectedSignedCookie = req.cookies[expectedCookieKey];

            const secret = env.SESSION_SECRET;

            //--> Fast - pass for valid cookies
            if (expectedSignedCookie) {
                return next()
            }

            //--> Resolve sessionId (from headers or tracker)
            let sessionId = (req.headers['x-csrf-token'] || req.headers['x-session-id']) as string | undefined;

            //--> Load from DB and rebuild cookie if needed
            if (sessionId) {
                const session = await SessionStore.findOne({ csrfToken: sessionId }).select('_id expires');

                if (session) {
                    const signed = `s:${signature.sign(session._id.toString(), secret)}`;
                    const maxAge = Math.floor((session.expires.getTime() - Date.now()) / 1000);
                    const { sameSite, secure } = cookieHelper.buildDefaultCookieOptions({ path });

                    let cookieString = `${expectedCookieKey}=${signed}; Path=${path}; HttpOnly; SameSite=${sameSite}; Expires=${session.expires.toUTCString()}; Max-Age=${maxAge}`;
                    if (secure) cookieString += '; Secure';
                    // Inject cookie into request + response
                    req.headers['cookie'] = cookieString;
                    res.setHeader('Set-Cookie', cookieString);
                }
            }

            return next()
        })

    }

    function cleanupSessionCookie() {
        app.use(async (req, res, next) => {
            const { requestOrigin, path, hasSession, isForged } = res.locals.sessionOptions
            let expectedCookieKey = ''

            if (guestHostOrigin.includes(requestOrigin)) {
                expectedCookieKey = COOKIE_KEYS.GENERAL_SESSION
            }
            if (requestOrigin == "admin") {
                expectedCookieKey = COOKIE_KEYS.ADMIN_SESSION
            }
            const expectedCookie = req.cookies[expectedCookieKey]

            // if (hasSession && isForged) {
            //     await SessionStore.deleteOne({ _id: req.sessionID })
            //         .catch(err => console.log('error cleaning session from session store : ', err))
            //     cookieHelper.clearCookie(res, { key: expectedCookieKey, path })
            // }
            if (!hasSession && expectedCookie) {
                cookieHelper.clearCookie(res, { key: expectedCookieKey, path })
            }
            return next()
        })
    }

    function enforceCsrfProtection() {
        app.use((req, res, next) => {
            const { csrf: csrfTokenFromSession } = req.session
            const { deviceType, requestOrigin } = res.locals.sessionOptions
            //exit early csrf protection not applicable to mobile and without valid session
            if (deviceType == 'mobile' || !csrfTokenFromSession) {
                return next();
            }

            let tokenFromClientHeaders = req.headers?.['x-csrf-token'];
            //for guest and host
            const sessionTrackerToken = req.cookies[COOKIE_KEYS.GENERAL_SESSION]
            //global session created for guest and host panel  no csrf check for it.
            if (sessionTrackerToken && requestOrigin != 'admin') {
                tokenFromClientHeaders = csrfTokenFromSession
            }

            //for admin csrf check is must. for guest and host it is not required.
            //making session useless if mismatch happen main session middlware will destroy session further.
            if (csrfTokenFromSession !== tokenFromClientHeaders) {
                req.user = undefined;
            }
            next();
        });
    }


    return {
        intializeExpressSession,
        syncSessionCookie,
        cleanupSessionCookie,
        enforceCsrfProtection
    }
}

export interface ITrackerOptions {
    sessionId: string,
    csrfToken: string
}

export type SessionMangerType = ReturnType<typeof createAuthSessionManager>;



export function setupPlaceSessionConfig(app: Application) {


    function attachPreSessionOptions() {

        app.use((req, res, next) => {
            const clientType = req.headers['client-type']
            const deviceType = clientType == "Mobile" ? 'mobile' : 'web'
            res.locals.sessionOptions = {
                ...res.locals.sessionOptions,
                ...cookiePathAndNameGenerator(req.originalUrl),
                deviceType: deviceType,
                hasSession: false,
                isForged: false,
                role: null,
                needsRefresh: false
            }
            next()
        })

    }


    function initializeSessionOptions() {

        app.use((req, res, next) => {
            const session = req.session
            const passportUser = getPassportSessionUserId(session)

            const intialSessionOptions = res.locals.sessionOptions

            if (!passportUser) {
                return next()
            }


            const clientSessionId = req.headers['x-csrf-token'] as string | undefined;
            let isSessionForged = false
            let needsRefresh = false
            const deviceType = intialSessionOptions?.deviceType
            const role = session?.role

            const tracker = req.cookies[COOKIE_KEYS.GENERAL_SESSION]

            if (deviceType == 'web' && intialSessionOptions.requestOrigin == 'host') {
                //no csrf check for  host
                if (tracker) {
                    needsRefresh = clientSessionId != session.csrf
                } else {
                    isSessionForged = true
                }

            }

            const realTimeSessionOptions = {
                hasSession: true,
                isForged: isSessionForged,
                role: role || null,
                needsRefresh
            }

            res.locals.sessionOptions = Object.freeze({
                ...res.locals.sessionOptions,
                ...realTimeSessionOptions,
            })

            next();
        })

    }

    return {
        attachPreSessionOptions,
        initializeSessionOptions
    }
}

export type SetupPlaceSessionConfig = ReturnType<typeof setupPlaceSessionConfig>;

