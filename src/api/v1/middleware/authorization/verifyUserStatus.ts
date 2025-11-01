
import { Request, Response, NextFunction } from "express";
import { User } from "../../models/user/user";
import { ApiError } from "../../utils/error-handlers/ApiError";

export default async function verifyUserAccountStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user?._id;
        const dbUser = await User.findById(userId).select('status');

        if (dbUser.status === 'suspended') {
            throw new ApiError(409, 'Your account is currently suspended. Please contact our support team for assistance.');
        }

        return next();
    } catch (err) {
        return next(err);
    }
}
