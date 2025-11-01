import { WebRtcPathsType } from "../../config/session/session.constant";
import { IConversationType } from "../../models/chats/room";
import { allSessionKeyVariable } from "../chat/constant";
import { NamespaceKeyType, RoomSessionVariableType, SocketServerType } from "../types/rtc.types";
import { RtcEventsKeysType } from "../types/rtc.types";

export function getRtcNamespaces(webRtcNamespaces: Partial<WebRtcPathsType>) {
    return {
        guest: webRtcNamespaces["/api/v1/guest/ws"],
        host: webRtcNamespaces["/api/v1/host/ws"],
        admin: webRtcNamespaces["/api/v1/admin/ws"]
    };
}


export function cleanSessionDetails(socket: SocketServerType, keysToRemove: Partial<RoomSessionVariableType> | null) {
    const keys = keysToRemove || allSessionKeyVariable;
    keys.forEach((key) => { socket[key] = undefined })
}


export function getReceiverPanelName(conversationType: IConversationType, namespaceKey: NamespaceKeyType) {

    let receiverPanelName
    let senderPanelName

    const [participantA, participantB] = conversationType.split('-')

    if (namespaceKey === participantA) {
        senderPanelName = participantA;
        receiverPanelName = participantB;
    } else {
        senderPanelName = participantB;
        receiverPanelName = participantA;
    }

    // const receiverPanelName = (namespaceKey === participantA) ? participantB : participantA

    return { receiverPanelName, senderPanelName }
}


export function emitEvent(socket: SocketServerType, roomUniqueId: string | null, eventName: RtcEventsKeysType, payload) {

    const fixedAttribute = { event: eventName }

    if (roomUniqueId) {
        socket.to(roomUniqueId).emit(eventName, { ...fixedAttribute, ...payload })
    }
    else {
        socket.emit(eventName, { ...fixedAttribute, ...payload })
    }

}

export function sendRTCNotification(socket: SocketServerType, roomUniqueId: string, receiverId: string) {
    const notificationPayload = { message: "you have new notification", hasNotification: true, receiverId }
    console.log("reviever id", socket.id);

    const isUserIsInRoom = socket.rooms?.has(roomUniqueId)

    if (!isUserIsInRoom) {
        emitEvent(socket, receiverId, "notification:alert", notificationPayload)
    }

    return isUserIsInRoom
}


export function leaveRoomAndNotify(
    senderSocket: SocketServerType,
    roomUniqueId: string
) {
    const { firstName, userId, profilePicture } = senderSocket.userDetails

    const messagePayloadForSessionUser = {
        event: "room:left",
        message: `You have left the room`,
        firstName,
        userId,
        profilePicture,
        roomUniqueId
    }

    const messagePayloadForOtherUsers = {
        event: "room:left",
        message: `${firstName} has left the room`,
        firstName,
        userId,
        profilePicture,
        roomUniqueId
    }

    senderSocket.emit("room:left", messagePayloadForSessionUser)

    senderSocket.to(roomUniqueId).emit("room:left", messagePayloadForOtherUsers)

    cleanSessionDetails(senderSocket, ['roomDetails'])
    senderSocket.leave(roomUniqueId)
}