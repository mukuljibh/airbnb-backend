import moment from "moment";
import { PipelineStage } from "mongoose";



export function buildChatExpirationPipeline(panel?: 'admin' | 'host' | 'guest') {



    const pipeline: PipelineStage[] = []

    const now = moment.utc(new Date).startOf('date').toDate()

    pipeline.push(
        {
            $lookup: {
                from: 'properties',
                let: {
                    propertyId: '$propertyId',
                    conversationType: '$conversationType'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['guest-host', '$$conversationType'] },
                                    { $eq: ['$_id', '$$propertyId'] },
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            title: 1,
                            thumbnail: 1,
                            location: 1,
                            gallery: 1,
                            status: 1,
                            isBookable: 1

                        }
                    }
                ],
                as: "propertyDetails"
            }
        },
        {
            $unwind: {
                path: "$propertyDetails",
                preserveNullAndEmptyArrays: true
            }
        },
    )
    pipeline.push(
        {
            $lookup: {
                from: 'reservations',
                let: {
                    conversationType: '$conversationType',
                    roomPropertyId: '$propertyId',
                    checkIn: '$queryDetails.checkIn',
                    checkOut: '$queryDetails.checkOut',
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $ne: ['$propertyDetails._id', null] },

                                    { $eq: ['guest-host', '$$conversationType'] },

                                    { $eq: ['$propertyId', '$$roomPropertyId'] },
                                    {
                                        $not: {
                                            $in: ['$status', ['cancelled']]
                                        }
                                    },
                                    { $lt: ['$$checkIn', '$checkOutDate'] },
                                    { $gt: ['$$checkOut', '$checkInDate'] },


                                ]
                            }
                        }
                    },
                    {
                        $limit: 1
                    }
                ],
                as: 'reservations'
            },


        },
        {

            $addFields: {
                isQueryDateReserved: {
                    $cond: {
                        if: { $eq: ['$conversationType', 'guest-host'] },
                        then: { $gt: [{ $size: '$reservations' }, 0] },
                        else: '$$REMOVE'
                    }
                },
                hasChatSessionExpired: {
                    $cond: {
                        if: { $eq: ['$conversationType', 'guest-host'] },
                        then: {
                            $or: [
                                { $ne: ['$propertyDetails.status', 'active'] },
                                { $eq: ['$propertyDetails.isBookable', false] },
                                { $gt: [{ $size: '$reservations' }, 0] },
                                { $lt: ['$queryDetails.checkIn', now] },
                                { $lt: ['$queryDetails.checkOut', now] }
                            ]
                        },
                        else: false
                        // else: {
                        //     $gt: [
                        //         { $subtract: [now, '$roomCreatedAt'] },
                        //         1000 * 60 * 60 * 24 * 7
                        //     ]
                        // }
                    }
                }
            }
        },
        {
            $project: {
                reservations: 0
            }
        }
    )

    return pipeline

}