import mongoose, { ClientSession, PipelineStage } from "mongoose";
import { PropertyStatusType } from "../../../models/property/types/property.model.types";
import { SearchSortOptions } from "../../../types/express";
import { IPaginationAttributes } from "../../../utils/pagination/pagination.types";
import moment from "moment";
import { Property } from "../../../models/property/property";
import { IPricing } from "../../../models/price/types/price.model.type";
import { getAvgReviewsForSinglePropertyPipeline } from "../../../utils/aggregation-pipelines/agregation.utils";
import { getBlockDates } from "../../general/properties/services/property.service";
import { normalizeCurrencyPayload } from "../../../models/price/utils/price.utils";
import getSymbolFromCurrency from "currency-symbol-map";
import { MongoObjectId } from "../../../types/mongo/mongo";
import { ApiError } from "../../../utils/error-handlers/ApiError";
import { PROPERTY_STATUS } from "../../../models/property/propertyAttributes/propertyAttributes";

export type sortFieldType = 'createdAt' | 'pricePerNight' | 'title' | 'address';

export async function getPropertyOrDraftList(
    filter: {
        status?: PropertyStatusType;
        hostId?: mongoose.Types.ObjectId;
        visibility?: 'published' | 'draft';
        'verification.status'?: unknown;
    },
    isUserAdmin: boolean,
    query: SearchSortOptions,
    pageAttribute: IPaginationAttributes,
) {
    const matchFilter: Record<string, unknown> = { ...filter };
    const todayDate = moment.utc(new Date()).startOf('date').toDate();
    const { searchTerm, sortField, sortDirection } = query;

    if (searchTerm && searchTerm.trim() !== '') {
        matchFilter.$or = [
            { title: { $regex: searchTerm, $options: 'i' } },
            { 'location.address': { $regex: searchTerm, $options: 'i' } },
            { 'location.city': { $regex: searchTerm, $options: 'i' } },
            { 'location.zipCode': { $regex: searchTerm, $options: 'i' } },
            { 'location.country': { $regex: searchTerm, $options: 'i' } },
            { 'location.state': { $regex: searchTerm, $options: 'i' } },

        ];
    }
    const aggregationPipeline: PipelineStage[] = []

    aggregationPipeline.push({ $match: matchFilter })

    aggregationPipeline.push({
        $lookup: {
            from: 'prices',
            localField: 'price',
            foreignField: '_id',
            as: 'priceData',
        },
    },
        { $unwind: { path: '$priceData', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'users',
                localField: 'hostId',
                foreignField: '_id',
                as: 'hostData',
            },
        },
        { $unwind: { path: '$hostData', preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "reservations",
                let: { propertyId: "$_id", today: todayDate },
                pipeline: [
                    {
                        $match: {
                            status: { $ne: 'cancelled' },
                            $expr: {
                                $and: [
                                    { $eq: ["$propertyId", "$$propertyId"] },
                                    { $gt: ["$checkOutDate", "$$today"] }
                                ]
                            }
                        }
                    },
                    { $limit: 1 }
                ],
                as: "reservationsData"
            }
        },
        {
            $addFields: {
                hasActiveBooking: { $gt: [{ $size: "$reservationsData" }, 0] }
            }
        }
    )


    if (!isUserAdmin) {
        aggregationPipeline.push({
            $addFields: {
                isPreviewReady: {
                    $cond: {
                        if: { $eq: ["$visibility", 'published'] },
                        then: true,
                        else: { $eq: ["$draftStage", 6] }
                    }
                },
                completedStages: '$draftStage'
            }
        });
    }
    aggregationPipeline.push({
        $project: {
            title: 1,
            thumbnail: 1,
            visibility: 1,
            hostId: isUserAdmin ? '$hostData._id' : undefined,
            updatedAt: 1,
            createdAt: 1,
            isPreviewReady: 1,
            completedStages: 1,
            pricePerNight: "$priceData.basePrice",
            status: {
                $cond: {
                    if: { $eq: ["$visibility", "draft"] },
                    then: {
                        $cond: {
                            if: { $eq: ["$verification.status", "open"] },
                            then: "$visibility",
                            else: "$verification.status"
                        }
                    },
                    else: "$status"
                }
            },
            location: 1,
            isBookable: 1,
            "verification.status": 1,
            "verification.reason": 1,
            "verification.lastStatus": 1,
            hasActiveBooking: 1,
            'user.email': '$hostData.email',
            'user.firstName': '$hostData.firstName',
            'user.lastName': '$hostData.lastName',
            'user.address': '$hostData.address',
            'user.profilePicture': '$hostData.profilePicture',
        },
    });

    switch (sortField) {
        case 'address':
            aggregationPipeline.push({
                $addFields: {
                    addressFirstChar: { $toLower: { $substrCP: ['$location.address', 0, 1] } }
                }
            });
            aggregationPipeline.push({ $sort: { addressFirstChar: sortDirection } });
            break;

        case 'title':
            aggregationPipeline.push({
                $addFields: {
                    titleFirstChar: { $toLower: { $substrCP: ['$title', 0, 1] } }
                }
            });
            aggregationPipeline.push({ $sort: { titleFirstChar: sortDirection } });
            break;

        case 'pricePerNight':
            aggregationPipeline.push({ $sort: { 'pricePerNight.amount': sortDirection } });
            break;

        case 'createdAt':
            aggregationPipeline.push({ $sort: { createdAt: sortDirection } });
            break;

        case 'status':
            aggregationPipeline.push({ $sort: { status: sortDirection } });
            break;

        default:
            aggregationPipeline.push({ $sort: { createdAt: -1, updatedAt: -1 } });
    }

    aggregationPipeline.push(
        { $skip: pageAttribute.startIndex },
        { $limit: pageAttribute.limit }
    );

    const propertyAggregation = Property.aggregate(aggregationPipeline);
    const countAggregation = Property.countDocuments(matchFilter);

    const [property, totalCount] = await Promise.all([
        propertyAggregation,
        countAggregation,
    ]);

    return {
        totalCount,
        property,
    };
}

export async function getSinglePropertyByFilter(
    filter: {
        _id: mongoose.Types.ObjectId;
        visibility?: 'published' | 'draft';
        hostId?: mongoose.Types.ObjectId;
    },
    userId?: mongoose.Types.ObjectId,
    guestRequestedCurrency = "INR",
    nonProjection = '-category -createdAt -updatedAt -thumbnail -verification -deletionRequestedAt'
) {
    try {
        // Fetch property, reviews, and wishlist in parallel
        const [property, topReviewsWithAvgRatings, blockDates] =
            await Promise.all([
                Property.findOne(filter)
                    .select(nonProjection)
                    .populate({
                        path: 'amenities',
                        select: 'title icon',
                    })
                    .populate('propertyRules')
                    .populate<{ price: IPricing }>({
                        path: 'price',
                        select: 'basePrice lengthDiscounts currencyExchangeRate',
                    })
                    .populate({
                        path: 'hostId',
                        select:
                            'firstName lastName profilePicture createdAt role languages email phone.number hasPhoneVerified hasEmailVerified',
                    })
                    .lean(),
                getAvgReviewsForSinglePropertyPipeline(filter._id, 5),
                getBlockDates(filter._id),
            ]);

        if (!property) {
            return null;
        }

        const hostId = property?.hostId?._id;
        const viewingOwnProperty = userId ? hostId.equals(userId) : null

        const hostCurrency = (property.price.basePrice.currency).toLowerCase()
        const { guestRequestCurrencyPayload } = await normalizeCurrencyPayload(
            property.price,
            ['amount'],
            hostCurrency,
            guestRequestedCurrency,
            'round'
        );

        return {
            ...property,
            price: {
                basePrice: guestRequestCurrencyPayload.amount,
                currency: guestRequestedCurrency,
                symbol: getSymbolFromCurrency(guestRequestedCurrency),
            },
            topReviewsWithAvgRatings,
            viewingOwnProperty,
            blockDates,
            discounts: property.price?.lengthDiscounts,
        };

    } catch (err) {
        console.error('getSinglePropertyByFilter error:', err);
        return null;
    }
};

interface BaseChangeOptions {
    adminId?: MongoObjectId
    userId: MongoObjectId;
    reason?: string;
    role?: 'system' | 'admin' | 'user';
    session?: ClientSession;
    propertyId?: MongoObjectId
}

export interface PropertyStatusChangeOptions extends BaseChangeOptions {
    newPropertyStatus?: PropertyStatusType | 'unsuspended' | 'release_deletion';
}


export async function changePropertyState(options: PropertyStatusChangeOptions) {
    const { userId, newPropertyStatus: requestedStatus, reason, role = 'system', session, propertyId } = options;

    const now = moment.utc().startOf('day').toDate();

    const filter: Record<string, any> = {

        hostId: userId,
        status: {
            $in: [PROPERTY_STATUS.ACTIVE,
            PROPERTY_STATUS.INACTIVE,
            PROPERTY_STATUS.SUSPENDED,
            PROPERTY_STATUS.PENDING_DELETION]
        }

    }
    if (propertyId) {
        filter._id = propertyId
    }
    const properties = await Property.find(filter).select('status statusMeta gallery location');

    const updatePromises = properties.map(async (property) => {
        if (property.status === requestedStatus) {
            return
        }
        const currentStatus = property.status;
        const lastMeta = property.statusMeta.at(-1);

        let finalStatus = requestedStatus;

        switch (requestedStatus) {
            case 'release_deletion':
                if (!lastMeta || currentStatus !== 'pending_deletion') {
                    throw new ApiError(409, 'User must be pending_deletion to release deletion');
                }
                finalStatus = lastMeta.previousStatus;
                break;

            case 'unsuspended':
                if (!lastMeta || currentStatus !== 'suspended') {
                    throw new ApiError(409, 'User must be suspended before unsuspending');
                }
                finalStatus = lastMeta.previousStatus;
                break;

            default:
                finalStatus = requestedStatus;
        }
        // Rollback logic for unsuspend/release-deletion
        // if (requestedStatus === 'unsuspended' && lastMeta && currentStatus === 'suspended') {
        //     finalStatus = lastMeta.previousStatus;
        // }
        // else if (requestedStatus === 'release_deletion' && lastMeta && currentStatus === 'pending_deletion') {
        //     finalStatus = lastMeta.previousStatus;
        // }

        // Append meta entry
        property.statusMeta.push({
            previousStatus: currentStatus,
            newStatus: finalStatus as PropertyStatusType,
            changedBy: { userId: ["system", "admin"].includes(role) ? null : userId, role },
            timestamp: now,
            reason: reason || 'System generated: user login triggered property activation.',
        });

        if (property.statusMeta.length > 10) {
            property.statusMeta = property.statusMeta.slice(-10);
        }

        property.status = finalStatus as PropertyStatusType;
        property.deletionRequestedAt = null;

        return property.save({ session });
    });

    await Promise.all(updatePromises);
}
