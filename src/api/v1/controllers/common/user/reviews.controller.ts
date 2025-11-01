import { Request, Response, NextFunction } from "express";
import { validateObjectId } from "../../../utils/mongo-helper/mongo.utils";
import { getHostAllPropertiesReviewsStatistics } from "../../../utils/aggregation-pipelines/agregation.utils";
import { formatPaginationResponse } from "../../../utils/pagination/pagination.utils";
import { ISessionUser } from "../../../models/user/types/user.model.types";
export async function getHostPropertiesAllReviews(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const pagesAttr = res.locals.pagination;
    const user = req.user as ISessionUser
    try {
        let hostId = user?._id
        const hostIdFromParams = req.params.hostId
        if (hostIdFromParams) {
            hostId = validateObjectId(hostIdFromParams);
        }

        const allReviewsDetails = await getHostAllPropertiesReviewsStatistics(
            hostId,
            pagesAttr,
        );

        const result = formatPaginationResponse(
            allReviewsDetails,
            allReviewsDetails?.totalReviewCount,
            pagesAttr,
        );
        res.json(result);
    } catch (err) {
        console.log(err);
        next(err);
    }
}