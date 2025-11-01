import { PipelineStage } from "mongoose";
import { cleanSessionDetails, emitEvent, leaveRoomAndNotify } from "../helpers/rtc.helper";
import { chatAudience } from "../../models/chats/chatAudience";
import { Room } from "../../models/chats/room";
import { ChatMessages } from "../../models/chats/chatMessages";
import { validatePayload } from "../middleware/validatePayload";
import { buildChatExpirationPipeline } from "../../controllers/common/conversations/pipelines/conversations.pipeline";
import { messagePayloadValidator } from "./schema";
import { confirmUploadResources } from "../../../uploads/services/upload.service";
import { IChatHandler } from "./register";



export function createChatHandler(options: IChatHandler) {

    const { socket, io } = options

    const { userDetails } = socket

    async function getreceiverSocketIds(roomId) {
        const { isActive, users } = await checkRoomHasActiveMember(roomId)

        if (isActive) {
            const socketIds = users.map((item) => {
                const socketId = item.socketId
                return socketId
            })
            return socketIds
        }
        return []
    }

    async function checkRoomHasActiveMember(roomId: string) {
        const sockets = await socket.in(roomId).fetchSockets();
        const users = sockets.map(socket => ({
            socketId: socket.id,
        }));
        return { isActive: users.length > 0, users }
    }

    function getNotificationChannel(conversationType, requestOrigin) {
        const mapping = {
            "guest-host": { guest: "host", host: "guest" },
            "guest-admin": { guest: "admin", admin: "guest" },
            "host-admin": { host: "admin", admin: "host" }
        };

        return mapping[conversationType]?.[requestOrigin] || requestOrigin;
    };

    async function broadcastUserStatus(roomId: string, status: 'online' | 'offline') {
        const message =
            status === "online"
                ? `The other participant, ${userDetails.firstName}, has joined the room.`
                : `The other participant, ${userDetails.firstName}, has left the room.`;


        const payload = {
            roomUniqueId: roomId,
            status,
            self: false,
            message
        }
        const { isActive } = await checkRoomHasActiveMember(roomId)

        if (isActive) {
            emitEvent(io, roomId, 'user:status', payload)
        }

    }

    function buildRoomPipeline(roomUniqueId: string): PipelineStage[] {
        const pipeline: PipelineStage[] = [
            { $match: { roomUniqueId } },
            {
                $lookup: {
                    let: { roomQueryId: "$roomQueryId" },
                    from: "roomqueries",
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$roomQueryId"] } } },
                        { $project: { roomId: 0 } }
                    ],
                    as: "queryDetails"
                }
            },
            { $unwind: { path: "$queryDetails", preserveNullAndEmptyArrays: true } },
            ...buildChatExpirationPipeline()
        ];
        return pipeline;
    }

    async function intiatlizeChatSession(newRoomUniqueId) {
        const oldRoom = socket?.roomDetails
        const { userId, ...restUserDetails } = userDetails;

        if (oldRoom) {
            const { roomUniqueId: oldRoomUniqueId } = oldRoom;
            if (newRoomUniqueId === oldRoomUniqueId) {
                await broadcastUserStatus(newRoomUniqueId, "online");
                throw new Error(`You are already present in room with Id: ${newRoomUniqueId}`)
            }
            leaveRoomAndNotify(socket, oldRoomUniqueId);
            await broadcastUserStatus(oldRoomUniqueId, "offline");

        }


        const roomPipeline = buildRoomPipeline(newRoomUniqueId);
        const [room] = await Room.aggregate(roomPipeline);

        if (!room) {
            throw new Error("No room found for provided room id please make sure you are providing the correct one.")
        }

        const hasChatSessionExpired = room?.hasChatSessionExpired
        if (hasChatSessionExpired) {
            throw new Error("Room session expired.")
        }

        const conversationType = room.conversationType
        const secondPerson = await chatAudience
            .findOne({ roomId: room._id, userId: { $ne: userId } })
            .select('userId');


        socket.roomDetails = {
            roomId: String(room._id),
            roomUniqueId: newRoomUniqueId,
            queryDetails: room.queryDetails,
            senderId: userId,
            receiverId: String(secondPerson.userId),
            conversationType,
            propertyDetails: room.propertyDetails,
            // receiverPanelName
        }

        socket.join(newRoomUniqueId);

        //notify current user
        const payload1 = {
            message: `You have joined the room`,
            ...socket?.userDetails,
            newRoomUniqueId
        }
        emitEvent(socket, null, "room:join", payload1)

        await broadcastUserStatus(newRoomUniqueId, 'online')
        console.log(`User ${restUserDetails.firstName} joined room: ${newRoomUniqueId}`);

    }

    async function listenForMessages(payload) {
        console.time("listenForMessages");
        const { requestOrigin } = socket.sessionOptions

        const { valid, data, errors } = await validatePayload(payload, messagePayloadValidator);
        const verifiedData = { message: '', ...data };

        if (!valid) {
            return emitEvent(socket, null, "error", errors);
        }

        if (data?.url) confirmUploadResources(data.url);

        const { roomId, roomUniqueId, receiverId, propertyDetails, queryDetails, conversationType } = socket.roomDetails;
        const { userId: senderId, ...restUserDetails } = userDetails;
        const now = new Date();

        const [newChatMessage] = await ChatMessages.create([{
            roomId,
            senderId,
            roomQueryId: queryDetails?._id,
            ...verifiedData
        }]);

        const messageId = newChatMessage._id;
        emitEvent(socket, null, "chat:stored", {
            messageId,
            roomId,
            roomUniqueId,
            queryDetails,
            senderId,
            ...verifiedData,
            ...restUserDetails
        });

        setImmediate(() => {
            Promise.all([
                Room.updateOne({ _id: roomId }, { $set: { roomLastActive: now } }),
                chatAudience.updateOne({ roomId, userId: senderId }, { $set: { lastSeenAt: now } }),
            ]).catch(err => console.error("Background update failed:", err));
        });

        const notificationPayload = {
            roomId,
            senderId,
            roomUniqueId,
            queryDetails,
            propertyDetails,
            hasChatSessionExpired: false,
            requestOrigin,
            alert: `You have a new message from ${restUserDetails.firstName}`,
            ...restUserDetails,
            ...verifiedData
        };

        const messagePayload = {
            messageId,
            roomUniqueId,
            queryDetails,
            senderId,
            createdAt: now,
            ...restUserDetails,
            ...verifiedData
        };

        const ids = await getreceiverSocketIds(roomUniqueId)
        if (ids.length == 0) {
            const recipentEnv = getNotificationChannel(conversationType, requestOrigin)
            const notificationChanel = `${receiverId}_${recipentEnv}`
            emitEvent(socket, notificationChanel, "notification:alert", notificationPayload);
        }
        emitEvent(socket, roomUniqueId, "chat:message", messagePayload);

        console.log(`Received message from ${restUserDetails.firstName} ${restUserDetails.lastName}:`, verifiedData.message);
        console.timeEnd("listenForMessages");
    }


    async function listenForAcknowledgeMessageEvents() {
        const { roomUniqueId, roomId, queryDetails } = socket.roomDetails || {};
        const { firstName, userId, ...restUserDetails } = socket?.userDetails || {};

        if (!roomId || !userId) {
            console.warn("Cannot acknowledge message: missing roomId or userId");
            return;
        }

        const lastSeenAt = new Date();


        chatAudience.updateOne(
            { roomId, userId },
            { $set: { lastSeenAt } }
        ).catch(err => console.error("Failed to update lastSeenAt:", err));


        const payload = {
            message: `${firstName} has read the message`,
            roomUniqueId,
            queryDetails,
            lastSeenAt,
            ...restUserDetails
        };

        emitEvent(socket, roomUniqueId, "user:ack-read", payload);
    }

    async function listenForUserTyping() {
        const { roomUniqueId } = socket.roomDetails

        const { firstName } = userDetails

        const payload = {
            message: `${firstName} is typing the message for you`,
            roomUniqueId
        }
        emitEvent(socket, roomUniqueId, "user:ack-typing", payload)
    }

    async function ackUserOnline() {

        // const { roomId, roomUniqueId } = socket.roomDetails

        // const { userId, ...restUserDetails } = userDetails

        // const fullName = `${restUserDetails.firstName} ${restUserDetails.lastName}`

        // const payload = {
        //     roomId: roomId,
        //     ...restUserDetails,
        //     roomUniqueId,
        //     status: 'online',
        //     self: false,
        //     message: `${fullName} is online and has acknowledged their presence in the room.`
        // }
        // emitEvent(socket, roomUniqueId, "user:status", payload)

        // emitEvent(rtcNamespaces[receiverPanelName], roomUniqueId, "user:status", payload)

    }
    async function handleRoomLeft() {
        const { roomUniqueId } = socket.roomDetails
        leaveRoomAndNotify(socket, roomUniqueId);
        await broadcastUserStatus(roomUniqueId, 'offline')
    }

    async function handleSocketDisconnect() {
        const { userDetails, roomDetails } = socket;
        const { firstName } = userDetails || {};

        // const userToken = socket.sessionOptions.token
        // if (connectedUsers.get(userToken) === socket.id) {
        //     console.log({ d: connectedUsers.get(userToken) });
        //     connectedUsers.delete(userToken);
        // }

        if (!roomDetails) {
            console.log(`${firstName || "Unknown"} disconnected — user exited without joining any room.`);
            cleanSessionDetails(socket, null);
            return
        }

        const { roomUniqueId } = roomDetails
        const payload = {
            event: "room:left",
            ...userDetails,
            message: `${firstName} has left the room.`,
        };

        emitEvent(socket, roomUniqueId, "room:left", payload);
        cleanSessionDetails(socket, null)

        console.log(`${firstName} disconnected — cleared room/session details.`);


    }

    return {
        intiatlizeChatSession,
        listenForMessages,
        listenForAcknowledgeMessageEvents,
        listenForUserTyping,
        ackUserOnline,
        handleRoomLeft,
        handleSocketDisconnect
    }
}