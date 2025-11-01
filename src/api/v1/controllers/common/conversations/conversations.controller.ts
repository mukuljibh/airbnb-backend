import { Request, Response, NextFunction } from "express";
import { Room } from "../../../models/chats/room";
import { ApiResponse } from "../../../utils/error-handlers/ApiResponse";
import { validateObjectId, withMongoTransaction } from "../../../utils/mongo-helper/mongo.utils";
import { ChatMessages } from "../../../models/chats/chatMessages";
import { ApiError } from "../../../utils/error-handlers/ApiError";
import { v4 as uuidv4 } from 'uuid';
import { User } from "../../../models/user/user";
import { PipelineStage } from "mongoose";
import { formatPaginationResponse } from "../../../utils/pagination/pagination.utils";
import { Property } from "../../../models/property/property";
import { chatAudience } from "../../../models/chats/chatAudience";
import { getRoomDetailsForProperty } from "./conversation.service";
import { buildChatExpirationPipeline } from "./pipelines/conversations.pipeline";
import { RoomQuery } from "../../../models/chats/roomQuery";
import moment from "moment";
import { MongoObjectId } from "../../../types/mongo/mongo";
import { sendApiResponseHelper } from "../../../helper/response/response.helper";


const normalizeConversationType = (panel1, panel2) => {
    const priority = { guest: 1, host: 2, admin: 3 };

    const sorted = [panel1, panel2].sort((a, b) => priority[a] - priority[b]);
    return `${sorted[0]}-${sorted[1]}`;
};

const allowedRequestPanel = ['all', 'guest', 'host', 'admin']
type ReceiverPanel = 'all' | 'guest' | 'host' | 'admin';
export async function getAllConversationsList(req: Request, res: Response) {
    const { requestOrigin: currentPanel } = res.locals.sessionOptions
    const { receiverPanel = 'all' } = req.query as { receiverPanel?: ReceiverPanel };

    if (!allowedRequestPanel.includes(receiverPanel)) {
        throw new ApiError(
            400,
            `Invalid panel query. Allowed inputs are: ${allowedRequestPanel.join(', ')}. Provided input: ${receiverPanel}.`
        );
    }
    if (currentPanel === receiverPanel) {
        console.warn('Attempted to request conversation list from the same panel');
        throw new ApiError(400, 'Cannot request conversation list from the same panel.');
    }

    const user = req.user;
    const { limit, startIndex } = res.locals.pagination;
    const conversationType = normalizeConversationType(currentPanel, receiverPanel);



    const roomFilter: Record<string, string | MongoObjectId> = { members: user._id }

    if (receiverPanel !== 'all') {
        roomFilter.conversationType = conversationType

    }


    const pipe: PipelineStage[] = []
    //matching any required filter

    pipe.push(
        { $match: roomFilter },
        { $project: { queryDetails: 0, members: 0, } }
    )


    const chatAudienceFilter = {
        "chatAudiences": {
            $elemMatch: {
                role: currentPanel,
                userId: user._id
            }
        }
    }

    pipe.push(
        {
            $lookup: {
                from: "chataudiences",
                localField: "_id",
                foreignField: "roomId",
                as: "chatAudiences"
            }
        },
        { $match: chatAudienceFilter }

    );

    pipe.push(
        {
            $lookup: {
                let: { roomQueryId: "$roomQueryId" },
                from: "roomqueries",
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$_id', '$$roomQueryId'] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            roomId: 0
                        }
                    }
                ],
                as: "queryDetails"
            }
        },
        {
            $unwind: {
                path: "$queryDetails",
                preserveNullAndEmptyArrays: true
            }
        }
    )


    //extracting details of the secondary person
    pipe.push({
        $lookup: {
            from: "users",
            localField: "chatAudiences.userId",
            foreignField: "_id",
            pipeline: [
                {
                    $project: {
                        firstName: 1,
                        lastName: 1,
                        profilePicture: 1
                    }
                }
            ],
            as: "audiences"
        }
    },
    )

    pipe.push(...buildChatExpirationPipeline())

    //attaching has notification flag
    pipe.push({
        $addFields: {
            currentAudience: {
                $first: {
                    $filter: {
                        input: "$chatAudiences",
                        as: "aud",
                        cond: {
                            $and: [
                                { $eq: ["$$aud.userId", user._id] },
                                { $eq: ["$$aud.role", currentPanel] }
                            ]
                        }
                    }
                }
            }
        }
    })

    pipe.push({
        $addFields: {
            hasNotification: {
                $cond: {
                    if: {
                        $or: [
                            { $eq: ["$currentAudience.lastSeenAt", null] },
                            { $eq: [{ $type: "$currentAudience.lastSeenAt" }, "missing"] }
                        ]
                    },
                    then: true,
                    else: {
                        $gt: ["$roomLastActive", "$currentAudience.lastSeenAt"]
                    }
                }
            }
        }
    })

    pipe.push(
        { $sort: { roomLastActive: -1 } },
        { $skip: startIndex },
        { $limit: limit }
    )

    pipe.push(
        {
            $project: {
                userRoomLastSeen: 0,
                // reservations: 0,
                chatAudiences: 0,
                currentAudience: 0,
                __v: 0
            }
        })

    const countPipeline: PipelineStage[] = [
        {
            $match: roomFilter
        },
        {
            $lookup: {
                from: "chataudiences",
                localField: "_id",
                foreignField: "roomId",
                as: "chatAudiences"
            }
        },
        { $match: chatAudienceFilter },
        { $count: "count" }

    ]
    const [[roomCount], roomResult] = await Promise.all([
        Room.aggregate<{ count?: number }>(countPipeline),
        Room.aggregate(pipe)
    ]);

    const result = formatPaginationResponse(roomResult, roomCount?.count || 0, res.locals.pagination);

    return sendApiResponseHelper(res, { statusCode: 200, raw: true, data: result })


}

export async function getAllConversationsByRoomId(req: Request, res: Response) {

    const user = req.user
    const { startIndex, limit } = res.locals.pagination
    const { requestOrigin: currentPanel } = res.locals.sessionOptions

    const roomId = validateObjectId(req.params.roomId)
    const validAudience = await chatAudience.findOne({ roomId, userId: user._id, role: currentPanel }).select("_id")
    if (!validAudience) {
        throw new ApiError(409, 'Your are not allowed to get chats from this room.')
    }

    const pipe: PipelineStage[] = []

    //match any filter
    pipe.push({
        $match: { roomId }
    },

    )
    pipe.push(

        {
            $lookup: {
                let: {
                    roomQueryId: "$roomQueryId"
                },
                from: "roomqueries",
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$_id', '$$roomQueryId'] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            roomId: 0, _v: 0
                        }
                    }
                ],
                as: "queryDetails"
            }
        },
        {
            $unwind: {
                path: "$queryDetails",
                preserveNullAndEmptyArrays: true
            }
        },
    )
    //join the user table by send id
    pipe.push(
        {
            $lookup: {
                from: 'users',
                localField: 'senderId',
                foreignField: '_id',
                pipeline: [
                    {
                        $project: {
                            firstName: 1,
                            lastName: 1,
                            profilePicture: 1,
                        }
                    }
                ],
                as: 'senderDetails',
            },
        },
        {
            $unwind: {
                path: "$senderDetails",
                preserveNullAndEmptyArrays: false
            }
        })


    //join userRoomlastSeen table to get user last seen in the room

    pipe.push(
        {
            $lookup: {
                from: "chataudiences",
                localField: "roomId",
                foreignField: "roomId",
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $ne: ["$userId", "$$senderId"]
                            }
                        }
                    },
                    {
                        $project: {
                            lastSeenAt: 1
                        }
                    }
                ],
                as: "audience",
                let: { senderId: "$senderId" }
            }
        },
        {
            $unwind: {
                path: "$audience",
                preserveNullAndEmptyArrays: true
            }
        })


    //attaching has seen flag to indicate user already read the message

    pipe.push(
        {
            $addFields: {
                hasSeen: {
                    $cond: {
                        if: {
                            $and: [
                                { $ne: ["$audience.lastSeenAt", null] },
                                { $gt: ["$audience.lastSeenAt", "$createdAt"] }
                            ]
                        },
                        then: true,
                        else: false
                    }
                },
                self: { $eq: ["$senderId", user._id] }
            }
        })

    //sorting based on id newest first
    pipe.push(
        { $sort: { createdAt: -1 } },
        { $skip: startIndex },
        { $limit: limit }
    )

    //removing uneccessary fields
    pipe.push(
        {
            $project: {
                userLastSeen: 0,
                roomId: 0,

            }
        })




    const [messages, messagesCount] = await Promise.all([
        ChatMessages.aggregate(pipe),
        ChatMessages.countDocuments({ roomId })
    ])

    const result = formatPaginationResponse(messages.reverse(), messagesCount, res.locals.pagination)
    return sendApiResponseHelper(res, { raw: true, data: result })

}


export async function initiateIntialConversation(req: Request, res: Response) {

    const user = req.user
    const { message, queryDetails, propertyId, receiverPanel } = req.body
    let { receiverId } = req.body
    // role comes from base url
    const { requestOrigin: currentPanel } = res.locals.sessionOptions

    if (receiverPanel == currentPanel) {
        throw new ApiError(400, 'You can not initate chat with same panel')
    }
    const sessionUser = await User.findById(user._id).select('status')

    if (sessionUser.status === "suspended" && receiverPanel != 'admin') {
        throw new ApiError(
            409,
            'Your account is currently suspended. Please contact our support team for assistance.'
        )
    }

    // actual role comes from db
    const receiverUser = await User.findOne({ _id: receiverId, role: receiverPanel }).select('role')

    if (!receiverUser) {
        throw new ApiError(404, 'No receiver found with provide id')
    }
    // const { role: receiverRole } = receiverUser
    const allowedRolesMap = {
        guest: ['admin', 'host'],
        host: ['admin'],
        admin: []
    };
    const allowedReceiverRoles = allowedRolesMap[currentPanel]

    const isAllowed = allowedReceiverRoles.includes(receiverPanel)

    // const isAllowed = allowedReceiverRoles.some(role => receiverRole.includes(role as Role));

    if (!isAllowed) {
        throw new ApiError(409, 'You cannot initiate the initial conversation');
    }

    if (receiverPanel === 'host') {
        const hostProperty = await Property.findOne({ _id: propertyId, hostId: receiverId, status: 'active' }).select('_id')
        if (!hostProperty) {
            throw new ApiError(404, 'No property found')
        }
    }

    if (receiverPanel === 'admin') {
        const admin = await User.findOne({ role: 'admin' }).select('_id')
        receiverId = admin._id
    }

    const conversationType = normalizeConversationType(currentPanel, receiverPanel)
    const filter = { propertyId: propertyId, conversationType }

    if (propertyId) {
        filter.propertyId = validateObjectId(propertyId)
    }
    const existingRoom = await getRoomDetailsForProperty(filter, user._id, currentPanel)

    if (existingRoom.hasRoom) {
        throw new ApiError(409, 'Room already exists. Please do not initiate a new one.');
    }

    let newRoom;


    await withMongoTransaction(async (session) => {

        const now = moment.utc(new Date).startOf('date').toDate()
        let query
        let newRoomQuery;

        if (conversationType === "guest-host") {
            // Save RoomQuery first
            newRoomQuery = await RoomQuery.create([{
                ...queryDetails
            }], { session, ordered: true });

            // Use its _id in room creation
            query = { roomQueryId: newRoomQuery[0]._id };
        }
        const memberIds = [user._id, receiverId]

        newRoom = await Room.create([{
            roomUniqueId: uuidv4(),
            // audiences: participants,
            members: memberIds,
            conversationType,
            roomLastActive: now,
            propertyId,
            ...query
        }], { session, ordered: true });

        if (conversationType === "guest-host") {
            await RoomQuery.updateOne(
                { _id: newRoomQuery[0]._id },
                { $set: { roomId: newRoom[0]._id } },
                { session, upsert: true }
            );
        }


        const awaitingChatAudiences = chatAudience.insertMany([
            { roomId: newRoom[0]._id, userId: user._id, role: currentPanel, lastSeenAt: now, },
            { roomId: newRoom[0]._id, userId: receiverId, role: receiverPanel, lastSeenAt: null, }
        ], { session, ordered: true });

        const awaitingCreatingChatMessage = ChatMessages.create([
            {

                roomId: newRoom[0]._id,
                senderId: user._id,
                message,
                ...query
            }
        ], { session, ordered: true });


        await Promise.all([
            awaitingChatAudiences,
            awaitingCreatingChatMessage
        ]);
    });


    return res.json(new ApiResponse(200, 'Conversations intiated successfully', newRoom[0]))
}




export async function updateConversation(req: Request, res: Response, next: NextFunction) {

    const user = req.user

    const { message, queryDetails, propertyId: clientPropertyId } = req.body

    try {

        const roomId = validateObjectId(req.params.roomId)

        // role comes from base url
        const { requestOrigin: currentPanel } = res.locals.sessionOptions

        const roomFilter: Record<string, any> = { _id: roomId }

        if (clientPropertyId) {
            roomFilter.propertyId = clientPropertyId
        }
        const existingRoom = await Room.findOne(roomFilter)

        if (!existingRoom) {
            throw new ApiError(409, 'Unable to process the request. Conversation room does not exist.');
        }
        const actualPropertyId = existingRoom.propertyId
        const conversationType = existingRoom.conversationType
        const filter: any = { _id: roomId, conversationType };

        if (actualPropertyId) {
            filter.propertyId = actualPropertyId;
        }

        const roomDetails = await getRoomDetailsForProperty(filter, user._id, currentPanel)

        if (!roomDetails.hasRoom) {
            const baseMsg = 'Unable to retrieve conversation details';
            const detailMsg =
                conversationType === 'guest-host'
                    ? ' for the selected property.'
                    : ' for the selected conversation.';

            throw new ApiError(404, baseMsg + detailMsg);
        }

        const hasChatSessionExpired = roomDetails?.hasChatSessionExpired

        if (!hasChatSessionExpired) {
            throw new ApiError(409, 'This room currently in active state can not intiate a new conversation');

        }

        await withMongoTransaction(async (session) => {
            const now = new Date()
            let query

            if (conversationType === "guest-host") {
                const newRoomQuery = await RoomQuery.create([{
                    roomId: roomId,
                    ...queryDetails,

                }], { session })
                query = { roomQueryId: newRoomQuery[0]._id }
            }


            const updateSetFields = { roomLastActive: now, roomCreatedAt: now, ...query, }
            if (conversationType === "guest-admin") {
                updateSetFields.queryDetails = undefined
            }
            await Promise.all([
                Room.updateOne({ _id: roomId }, { $set: updateSetFields }, { session, ordered: true }),
                ChatMessages.create([
                    {
                        roomId,
                        senderId: user._id,
                        message,
                        ...query,
                    }
                ], { session, ordered: true })
            ])
        })


        return res.json(new ApiResponse(200, 'Conversation updated successfully', roomDetails))
    }
    catch (err) {
        return next(err)
    }



}

export async function updateChatMessageById(req: Request, res: Response) {

    const roomId = validateObjectId(req.params.roomId)
    const messageId = validateObjectId(req.params.messageId)

    const { message, url } = req.body

    const chatMessageObject = await ChatMessages.findOne({ roomId, _id: messageId })
    if (!message) {
        throw new ApiError(404, 'No message found to update')
    }

    await ChatMessages.deleteOne({ _id: chatMessageObject._id })

    return res.json(new ApiResponse(200, 'chat message updated successfully.'))
}
export async function deleteChatMessageById(req: Request, res: Response) {

    const roomId = validateObjectId(req.params.roomId)
    const messageId = validateObjectId(req.params.messageId)

    const { message, url } = req.body

    const chatMessageObject = await ChatMessages.findOne({ roomId, _id: messageId })
    if (!message) {
        throw new ApiError(404, 'No message found to update')
    }
    const messageType = chatMessageObject.messageType

    if (messageType === "plain") {
        chatMessageObject.message = message
    }
    if (messageType === "attachment") {
        chatMessageObject.message = url
    }


    await chatMessageObject.save()

    return res.json(new ApiResponse(200, 'chat message deleted successfully.'))

}