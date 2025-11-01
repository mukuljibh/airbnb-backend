import { Response, Request, NextFunction } from 'express';
import { validateObjectId, withMongoTransaction } from '../../../utils/mongo-helper/mongo.utils';

import { VERIFICATION_STATUS } from "../../../models/property/propertyAttributes/propertyAttributes";
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { PipelineStage } from 'mongoose';
import { PropertyUpdateModel } from '../../../models/property/propertyUpdates';
import { formatPaginationResponse } from '../../../utils/pagination/pagination.utils';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { Property } from '../../../models/property/property';
import { syncAndDeleteFiles } from '../../../../uploads/services/upload.service';
import { IProperty, PropertyUpdateStatus } from '../../../models/property/types/property.model.types';
import { createRecipient, dispatchNotification } from '../../common/notifications/services/dispatch.service';


export async function getAllPendingPropertyUpdateApplications(req: Request, res: Response, next: NextFunction) {


    try {
        const { status = VERIFICATION_STATUS.PENDING } = req.query

        if (![VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.REJECTED, VERIFICATION_STATUS.VERIFIED].includes(status as PropertyUpdateStatus)) {
            throw new ApiError(400, "Invalid verification status provided. Status must be one of: Pending, Rejected, or Verified.");
        }

        const filter: Record<string, unknown> = { status }

        const explicitFilter: Record<string, unknown> = {}

        const { pagination, search, sort } = res.locals

        const { sortDirection } = sort
        let { sortField } = sort

        const { searchTerm } = search

        const basePipeline: PipelineStage[] = [
            { $match: filter },
            {
                $lookup: {
                    from: 'properties',
                    localField: 'propertyId',
                    foreignField: '_id',
                    pipeline: [{ $project: { title: 1 } }],
                    as: 'propertyDetails'
                }
            },
            {
                $unwind: {
                    path: '$propertyDetails',
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $project: {
                    propertyId: 1,
                    propertyDetails: 1,
                    requestAt: 1,
                    status: 1,
                    userId: 1,
                    changedFields: 1,
                    updatedAt: 1,
                    isUserBannerDismissed: 1
                }
            }
        ];

        if (searchTerm && searchTerm.trim() !== '') {
            const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            explicitFilter.$or = [
                { 'propertyDetails.title': { $regex: escapedSearchTerm, $options: 'i' } }
            ];
        }

        basePipeline.push({ $match: explicitFilter });

        sortField = sortField === 'propertyName' ? 'propertyDetails.title' : sortField

        // Pipeline for fetching paginated data
        const pendingUpdatesPipeline = [
            ...basePipeline,
            { $sort: { [sortField]: sortDirection } },
            { $skip: pagination.startIndex },
            { $limit: pagination.limit }
        ];

        // Pipeline for counting only
        const countPipeline = [
            ...basePipeline,
            { $count: 'countDoc' }
        ];

        const [pendingUpdates, count] = await Promise.all([
            PropertyUpdateModel.aggregate(pendingUpdatesPipeline),
            PropertyUpdateModel.aggregate(countPipeline)
        ]);

        const totalCount = count.length > 0 ? count[0].countDoc : 0;

        const result = formatPaginationResponse(pendingUpdates, totalCount, pagination);



        return res.json(result)
    }
    catch (err) {
        return next(err)
    }
}

export async function getSingleUpdateApplicationByUpdateId(req: Request, res: Response, next: NextFunction) {

    try {

        const updateId = validateObjectId(req.params.updateId)
        const propertyId = validateObjectId(req.params.propertyId)

        const [propertyUpdate] = await PropertyUpdateModel.aggregate([
            {
                $match: {
                    _id: updateId, propertyId

                }
            },
            {
                $lookup: {
                    from: 'properties',
                    localField: 'propertyId',
                    foreignField: '_id',
                    pipeline: [
                        {
                            $project: {
                                title: 1
                            }
                        }
                    ],
                    as: 'propertyDetails'
                }
            },
            {
                $unwind: {
                    path: '$propertyDetails',
                    preserveNullAndEmptyArrays: false
                }
            }

        ])

        return res.json(new ApiResponse(200, 'Property update fetched successfully', propertyUpdate))
    }
    catch (err) {
        return next(err)
    }

}

export async function getAllPendingPropertyUpdateByPropertyId(req: Request, res: Response, next: NextFunction) {
    try {

        const propertyId = validateObjectId(req.params.propertyId)

        const result = await PropertyUpdateModel.aggregate([
            {
                $match: {
                    propertyId
                }
            },
            {
                $lookup: {
                    from: 'properties',
                    let: {
                        propertyId: '$propertyId'
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$$propertyId', '$_id']
                                }
                            }
                        },
                        {
                            $project: {
                                title: 1
                            }
                        }
                    ],
                    as: 'propertyDetails'
                }
            },
            {
                $unwind: {
                    path: '$propertyDetails',
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $sort: {
                    requestAt: -1
                }
            },
            {
                $project: {
                    propertyId: 1,
                    propertyDetails: 1,
                    hostRemark: 1,
                    requestAt: 1,
                    status: 1,
                    userId: 1,
                    changedFields: 1,
                    updatedAt: 1,
                    isUserBannerDismissed: 1
                }
            }
        ]
        )

        return res.json(new ApiResponse(200, 'All Property updates fetched successfully', result))
    }
    catch (err) {
        return next(err)
    }
}

export async function verifyPendingUpdatesByUpdateId(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { status, adminRemark, rejectedFields } = req.body;
        const updateId = validateObjectId(req.params.updateId);
        const propertyId = validateObjectId(req.params.propertyId);

        if (!['verified', 'rejected'].includes(status)) {
            throw new ApiError(400, 'Status can only be verified | rejected');
        }
        if (!adminRemark) {
            throw new ApiError(400, 'Admin remark is compulsory');
        }

        const now = new Date();
        const pendingUpdate = await PropertyUpdateModel.findOne({ _id: updateId, propertyId })
            .populate<{ propertyId: IProperty }>('propertyId', 'verification gallery title hostId');
        const property = pendingUpdate.propertyId

        if (!pendingUpdate) throw new ApiError(404, 'No pending update found');

        const setPayload: Record<string, unknown> = { status, adminRemark };

        await withMongoTransaction(async (session) => {
            if (status === 'verified') {
                setPayload.verifiedAt = now;
                await Promise.all([
                    syncAndDeleteFiles({ existingFiles: property?.verification?.documents, incomingFiles: pendingUpdate.documents, session }),

                    syncAndDeleteFiles({ existingFiles: property?.gallery, incomingFiles: pendingUpdate.gallery ?? [], session }),

                ]);

            } else {
                Object.assign(setPayload, {
                    rejectedAt: now,
                    isUserBannerDismissed: false,
                    rejectedFields,
                });
            }

            const propertyUpdateSetfield = { hasPendingSensitiveUpdates: null };

            if (status === 'verified') {
                for (const field of pendingUpdate.changedFields ?? []) {
                    if (field === 'documents') {
                        propertyUpdateSetfield['verification.documents'] = pendingUpdate.documents;
                    } else {
                        propertyUpdateSetfield[field] = pendingUpdate[field];
                    }
                }
            }
            await Promise.all([
                Property.updateOne({ _id: propertyId }, { $set: propertyUpdateSetfield }, { session }),
                PropertyUpdateModel.updateOne({ _id: updateId, propertyId }, { $set: setPayload }, { session }),
            ]);
        });
        const isVerified = status === 'verified'

        const payload = createRecipient('inApp', {
            userId: String(property.hostId),
            message: isVerified
                ? `Your property update request for "${property.title}" has been successfully approved.`
                : `Your property update request for "${property.title}" was rejected. Please review and resubmit.`,
            visibleToRoles: ['host'],
            title: isVerified
                ? `Property Update Request Approved`
                : `Property Update Request Rejected`,
            redirectKey: 'property-update-request',
            metadata: {
                propertyId: String(property._id),
                updateId: String(pendingUpdate._id)
            }
        })

        dispatchNotification({ recipients: [payload] })

        return res.json(new ApiResponse(200, `Update status changed to ${status} successfully.`));
    } catch (err) {
        console.error({ err });
        next(err);
    }
}

