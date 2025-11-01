import { PipelineStage } from "mongoose";
import { MongoObjectId } from "../types/mongo/mongo";
import { Room } from "../models/chats/room";
import { validateObjectId } from "../utils/mongo-helper/mongo.utils";

interface IRoomWithAdmin {
    targetUserId: MongoObjectId,
    adminUserId?: MongoObjectId
}

export async function getAllRoomWithAdmin(options: IRoomWithAdmin) {
    const { targetUserId } = options
    const pipeline: PipelineStage[] = [

        {
            $match: {
                conversationType: { $in: ['guest-admin', "host-admin"] },
                members: validateObjectId(targetUserId)
            }
        },
        {
            $project: {
                roomId: "$_id",
                roomUniqueId: 1
            }
        },

    ]

    const rooms = await Room.aggregate<{ roomId: MongoObjectId, roomUniqueId: string }>(pipeline)

    return rooms ?? []
}
