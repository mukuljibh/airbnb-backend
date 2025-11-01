import MongoStore from 'connect-mongo';
import session from 'express-session';
import { generateMilliSeconds } from '../../utils/dates/dates.utils';
import { Server as socketServer } from "socket.io"
import env from '../env';
import { COOKIE_KEYS } from '../../constant/cookie.key.constant';
import { cookieHelper } from '../../helper/cookies/cookies.helper';

export const timeUnit = '1d';

const timeUnitInMilliSeconds = generateMilliSeconds(timeUnit);
//make it half
const timeUnitInSeconds = timeUnitInMilliSeconds / (1000 * 2);

export const webRtcPaths = ['/api/v1/guest/ws', '/api/v1/host/ws', '/api/v1/admin/ws'] as const

export type WebRtcPathsType = {
    [k in typeof webRtcPaths[number]]: socketServer
}

//this option is valid for guest and host
const guestHostOptions = cookieHelper.buildDefaultCookieOptions({ path: '/api/v1' })
const adminCookieOptions = cookieHelper.buildDefaultCookieOptions({ path: '/api/v1/admin' })
export const sessions = {

    userSession: session({
        name: COOKIE_KEYS.GENERAL_SESSION,
        secret: env.SESSION_SECRET,
        //rolling will issue cookie updated cookie on client on each request
        // rolling: true,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: env.MONGO_URL,
            collectionName: 'sessions',
            //this field will extend the expiry of the session.
            touchAfter: timeUnitInSeconds,
            // stringify: false
        }),
        cookie: {
            httpOnly: guestHostOptions.httpOnly,
            secure: guestHostOptions.secure,
            sameSite: guestHostOptions.sameSite,
            path: guestHostOptions.path,
            maxAge: timeUnitInMilliSeconds,
        },
        proxy: true,
    }),

    adminSession: session({
        name: COOKIE_KEYS.ADMIN_SESSION,
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: env.MONGO_URL,
            collectionName: 'sessions',
            touchAfter: timeUnitInSeconds,
        }),
        cookie: {
            httpOnly: adminCookieOptions.httpOnly,
            secure: adminCookieOptions.secure,
            sameSite: adminCookieOptions.sameSite,
            path: adminCookieOptions.path,
            maxAge: timeUnitInMilliSeconds,
        },
        proxy: true,
    }),
    globalSession: session({
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: env.MONGO_URL,
            collectionName: 'sessions',
            touchAfter: timeUnitInSeconds,
        }),
        proxy: true,
    })
}

