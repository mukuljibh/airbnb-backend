import { Response } from "express";
import { ApiResponse } from "../../utils/error-handlers/ApiResponse";
import { ApiError } from "../../utils/error-handlers/ApiError";

interface ISendResponse {
    statusCode?: number,
    message?: string,
    data?: any,
    raw?: boolean
}

function normalizeMessage(msg: string): string {
    if (!msg) return "Request completed.";
    msg = msg.trim();
    msg = msg.charAt(0).toUpperCase() + msg.slice(1);

    if (!/[.!?]$/.test(msg)) msg += "."

    return msg;
}

export async function sendApiResponseHelper<T extends Response, K extends ISendResponse>(
    res: T,
    result: K
) {
    const { statusCode = 200, data = null, raw = false } = result;
    let { message = "Request completed" } = result
    message = normalizeMessage(message);

    if (raw) return res.json({ message, ...(data || {}) });

    if (statusCode >= 400) throw new ApiError(statusCode, message, data);

    return res.json(new ApiResponse(statusCode, message, data));
}
