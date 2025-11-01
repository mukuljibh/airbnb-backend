import { CookieOptions, Response } from "express";
import { ExpirationProps } from "../../utils/dates/dates.types";
import env from "../../config/env";
import { generateExpTime } from "../../utils/dates/dates.utils";

interface IBaseCookieOptions {
    path: string;
    httpOnly?: boolean;
}

interface ISetCookieOptions extends IBaseCookieOptions {
    exp: ExpirationProps;
}

interface IClearCookieOptions extends IBaseCookieOptions { }

interface ISetCookiePayload extends ISetCookieOptions {
    key: string;
    value: string;
}

interface IClearCookiePayload extends IClearCookieOptions {
    key: string;
}

export function createCookieHelper() {

    function buildDefaultCookieOptions(options: IBaseCookieOptions): CookieOptions {
        const { httpOnly = true, path } = options;
        const sameSite: CookieOptions["sameSite"] = env.NODE_ENV == 'production' ? "none" : "lax";
        const secure = env.NODE_ENV == 'production' ? true : false

        return {
            httpOnly,
            secure,
            sameSite,
            path,
        };
    }


    function buildCookieOptions(payload: ISetCookieOptions) {
        const { path, httpOnly, exp } = payload

        const expiration = generateExpTime(exp)
        return {
            ...buildDefaultCookieOptions({ path, httpOnly }),
            expires: expiration
        }
    }


    function buildClearCookieOptions(payload: IClearCookieOptions) {
        const { path, httpOnly } = payload
        const options = buildDefaultCookieOptions({ path, httpOnly })
        return options
    }

    function setCookie(res: Response, payload: ISetCookiePayload, useResponse = true) {
        const { key, value, path, httpOnly = true, exp } = payload
        const options = buildCookieOptions({ exp, path, httpOnly })
        res.cookie(key, value, options);
    }


    function clearCookie(res: Response, payload: IClearCookiePayload) {
        const { key, path, httpOnly } = payload
        const options = buildClearCookieOptions({ path, httpOnly })
        res.clearCookie(key, options);
    }


    return {
        // buildCookieOptions,
        // buildClearCookieOptions,
        buildDefaultCookieOptions,
        setCookie,
        clearCookie,
    }

}


const cookieHelper = createCookieHelper()
export { cookieHelper }