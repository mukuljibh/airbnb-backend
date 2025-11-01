import { Request, Response, NextFunction } from "express"
import { validateObjectId, withMongoTransaction } from "../../../utils/mongo-helper/mongo.utils"
import { Property } from "../../../models/property/property"
import { ApiError } from "../../../utils/error-handlers/ApiError"
import { syncAndDeleteFiles } from "../../../../uploads/services/upload.service"
import { PropertyUpdateModel } from "../../../models/property/propertyUpdates"
import { ApiResponse } from "../../../utils/error-handlers/ApiResponse"
import { formatPaginationResponse } from "../../../utils/pagination/pagination.utils"
import _ from "lodash"
import { createRecipient, dispatchNotification } from "../../common/notifications/services/dispatch.service"
import { User } from "../../../models/user/user"
import { IUser } from "../../../models/user/types/user.model.types"

export async function submitUpdateRequest(req: Request, res: Response, next: NextFunction) {

    const user = req.user

    try {

        const propertyId = validateObjectId(req.params.propertyId)

        const { gallery, location, documents, changedFields, hostRemark } = req.body

        const property = await Property.findOne({ _id: propertyId, hostId: user._id, visibility: 'published' }).populate<{ hostId: IUser }>('hostId', 'firstName lastName')

        if (!property) {
            throw new ApiError(404, 'No property found to update.')
        }
        const hasPendingSensitiveUpdates = property?.hasPendingSensitiveUpdates

        if (hasPendingSensitiveUpdates) {
            throw new ApiError(409, 'Your property is already under change can not process the request further')
        }
        const locationGeo = {
            type: 'Point',
            coordinates: [location?.coordinates?.longitude || 0, location?.coordinates?.latitude || 0]
        }
        const updates = {
            propertyId,
            gallery,
            location: { ...location, locationGeo },
            documents,

        }

        let updateRecord;
        await withMongoTransaction(async (session) => {
            await Promise.all([
                syncAndDeleteFiles({ existingFiles: [], incomingFiles: documents ?? [], session }),
                syncAndDeleteFiles({ existingFiles: [], incomingFiles: gallery ?? [], session }),
            ]);


            updateRecord = await new PropertyUpdateModel({
                ...updates,
                userId: user._id,
                changedFields,
                hostRemark,
                propertyId
            }).save({ session });

            await Property.updateOne(
                { _id: property._id },
                { $set: { hasPendingSensitiveUpdates: true } },
                { session }
            );

            const extraDocs = await PropertyUpdateModel.find({ propertyId })
                .sort({ requestAt: -1 })
                .skip(10)
                .select('_id')
                .lean()
                .session(session);

            if (extraDocs.length) {
                await PropertyUpdateModel.deleteMany({
                    _id: { $in: extraDocs.map(x => x._id) }
                }).session(session);
            }
        });


        const admin = await User.findOne({ role: 'admin' }).select('_id')
        const payload = createRecipient('inApp', {
            redirectKey: 'property-update-request',
            metadata: {
                propertyId: String(property._id),
                updateId: String(updateRecord?._id)
            },
            message: `${property.hostId.firstName} ${property.hostId.lastName} has submitted a request to update their property. Review the details to approve or reject the changes.`,
            visibleToRoles: ['admin'],
            title: `Update Request: ${property.title}`,
            userId: String(admin._id),
        });


        dispatchNotification({ recipients: [payload] })

        return res.json(new ApiResponse(201, 'Your property updates have been submitted for review.'));

    }
    catch (err) {
        console.log({ err });

        return next(err)
    }

}


export async function getPropertyUpdateRequestHistory(req: Request, res: Response, next: NextFunction) {

    const user = req.user
    try {
        const { pagination } = res.locals

        const propertyId = validateObjectId(req.params.propertyId)

        const property = await Property.findOne({ _id: propertyId, hostId: user._id, visibility: 'published' })


        if (!property) {
            throw new ApiError(404, 'No property found to update.')
        }

        const filter = { propertyId, userId: user._id }

        const [requestHistory, count] = await Promise.all([await PropertyUpdateModel.aggregate([
            {
                $match: filter
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
            { $sort: { requestAt: -1 } },
            { $skip: pagination.startIndex },
            { $limit: pagination.limit },
        ]), PropertyUpdateModel.countDocuments(filter)])


        const result = formatPaginationResponse(requestHistory, count, pagination)
        return res.status(200).json(result)

    }
    catch (err) {
        console.log({ err });

        return next(err)
    }

}

export async function getPropertyDetailsForUpdate(req: Request, res: Response, next: NextFunction) {

    const user = req.user
    try {

        const propertyId = validateObjectId(req.params.propertyId)

        const property = await Property.findOne({ _id: propertyId, hostId: user._id, visibility: 'published' })

        if (!property) {
            throw new ApiError(404, 'No property found to get update context prefill data.')
        }

        const update = {
            propertyDetails: _.pick(property, ['title']),
            documents: property.verification.documents,
            gallery: property.gallery,
            location: property.location,
            status: null,
            changeFields: null,
            hostRemark: null,
            adminRemark: null,
            rejectedFields: null
        }


        const pendingUpdate = await PropertyUpdateModel.findOne({ propertyId: property._id, userId: user._id }).sort({ createdAt: -1 })

        if (pendingUpdate?.status === 'pending' || pendingUpdate?.status === 'rejected') {
            Object.assign(update, {
                documents: pendingUpdate.documents,
                gallery: pendingUpdate.gallery,
                location: pendingUpdate.location,
                changeFields: pendingUpdate.changedFields,
                status: pendingUpdate.status,
                hostRemark: pendingUpdate.hostRemark,
                adminRemark: pendingUpdate.adminRemark,
                rejectedFields: pendingUpdate.rejectedFields

            })
        }

        return res.json(new ApiResponse(200, 'Property edit details fetched successfully for form prefill.', update));

    }
    catch (err) {
        console.log({ err });

        return next(err)
    }

}


export async function getPropertyUpdateById(req: Request, res: Response, next: NextFunction) {

    const user = req.user
    try {

        const propertyId = validateObjectId(req.params.propertyId)
        const updateId = validateObjectId(req.params.updateId)

        const [propertyUpdate] = await PropertyUpdateModel.aggregate([
            {
                $match: {
                    _id: updateId, propertyId, userId: user._id

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

        return res.json(new ApiResponse(200, 'Property update request fetched successfully', propertyUpdate))

    }
    catch (err) {
        console.log({ err });
        return next(err)
    }

}