import mongoose from 'mongoose';
import { MongoObjectId } from '../../../types/mongo/mongo';
import { chatAudience } from '../../../models/chats/chatAudience';
import { IRoomQuery } from '../../../models/chats/roomQuery';
import { Reservation } from '../../../models/reservation/reservation';
import moment from 'moment';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';


type filterType = {
    _id?: MongoObjectId,
    roomUniqueId?: MongoObjectId,
    propertyId?: MongoObjectId,
    conversationType: string
}

type RoomQueryResult = {
    _id?: MongoObjectId
    roomId?: MongoObjectId;
    propertyId?: MongoObjectId;
    roomUniqueId?: string;
    queryDetails?: IRoomQuery | null;
}

export type RoomSessionStatus = RoomQueryResult & {
    hasRoom: boolean;
    hasChatSessionExpired: boolean;
    isQueryDateReserved?: boolean;
};
export async function getRoomDetailsForProperty(
    filter: filterType,
    userId: mongoose.Types.ObjectId,
    role: 'admin' | 'guest' | 'host' | 'unknown',

) {

    const { propertyId, conversationType, _id: roomId, roomUniqueId } = filter
    const [firstWord, secondWord] = conversationType.split('-')

    if (firstWord === secondWord || !userId) {
        return null
    }

    const chatUserFilter = {
        userId: userId,
        role: role
    }

    const roomMatchCondition: any = {
        $expr: {
            $and: [
                { $eq: ["$_id", "$$roomId"] },
                { $eq: ["$conversationType", conversationType] }
            ]
        }
    };



    if (propertyId && conversationType == 'guest-host') {
        roomMatchCondition.$expr.$and.push({ $eq: ["$propertyId", propertyId] });
    }

    if (roomId) {
        roomMatchCondition.$expr.$and.push({ $eq: ["$_id", validateObjectId(roomId)] });
    }
    if (roomUniqueId) {
        roomMatchCondition.$expr.$and.push({ $eq: ["$roomUniqueId", roomUniqueId] });
    }


    const [roomInfo] = await chatAudience.aggregate<RoomQueryResult>(
        [
            {
                $match: chatUserFilter
            },
            {
                $project: {
                    roomId: 1
                }
            },
            {
                $lookup: {
                    from: "rooms",
                    let: { roomId: "$roomId" },
                    pipeline: [
                        {
                            $match: roomMatchCondition
                        },
                        {
                            $project: {
                                _id: 1,
                                propertyId: 1,
                                roomQueryId: 1,
                                roomUniqueId: 1
                            }
                        },
                        {
                            $lookup: {
                                from: "roomqueries",
                                localField: "roomQueryId",
                                foreignField: "_id",
                                as: "queryDetails"
                            }
                        },
                        { $unwind: { path: "$queryDetails", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                roomId: "$_id",
                                roomUniqueId: 1,
                                queryDetails: { $ifNull: ["$queryDetails", null] },
                                propertyId: 1,
                            }
                        }
                    ],
                    as: "roomBundle"
                }
            },
            { $unwind: { path: "$roomBundle", preserveNullAndEmptyArrays: false } },
            {
                $replaceRoot: { newRoot: "$roomBundle" }
            }
        ]
    );

    const payload: RoomSessionStatus = {
        _id: roomInfo?.roomId,
        roomUniqueId: roomInfo?.roomUniqueId,
        hasRoom: Boolean(roomInfo?.roomId),
        hasChatSessionExpired: roomInfo?.roomId == undefined ? null : false,
    }

    if (conversationType != 'guest-host') {
        return payload
    }

    if (conversationType === 'guest-host' && roomInfo?.queryDetails) {
        const now = moment.utc(new Date).startOf('date').toDate()
        const { checkIn, checkOut } = roomInfo.queryDetails;
        const isQueryDateReserved = await Reservation.exists({
            status: { $ne: 'cancelled' },
            propertyId,
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn },
        });

        const queryDatesEnd = (checkIn < now && checkOut < now);

        payload.hasChatSessionExpired = Boolean(isQueryDateReserved) || queryDatesEnd;
        payload.isQueryDateReserved = Boolean(isQueryDateReserved);
        payload.queryDetails = roomInfo.queryDetails;
    }

    return payload

}