import mongoose from "mongoose"
import { Socket } from "socket.io"
import { SocketPubEvents } from "../chat/constant"
import { IConversationType } from "../../models/chats/room"
import { allSessionKeyVariable } from "../chat/constant"
import { getRtcNamespaces } from "../helpers/rtc.helper"
import { Role } from "../../types/session/session"
import { MongoObjectId } from "../../types/mongo/mongo"

export type WebRtcNamespacesTypes = ReturnType<typeof getRtcNamespaces>;

export type NamespaceKeyType = keyof WebRtcNamespacesTypes

export type RoomSessionVariableType = typeof allSessionKeyVariable

export type RoomDetailsType = {
    receiverPanelName?: string,
    roomUniqueId: string,
    roomId: string,
    senderId: string,
    receiverId: string,
    queryDetails: {
        _id: mongoose.Types.ObjectId,
        checkIn: Date,
        checkOut: Date,
        adults: number,
        children: number,
        currency: string
    }

    conversationType: IConversationType,
    propertyDetails: {
        _id: mongoose.Types.ObjectId,
        title: string,
        thumbnail: string
    }
}

export type UserDetailsType = {
    firstName: string,
    lastName: string,
    profilePicture: string,
    userId: string,
    role: Role[]
}
export interface AuthenticatedRequest {
    userId: MongoObjectId,
    requestOrigin: Role,
    token: string
}

export type SocketServerType = Socket & {
    sessionOptions: AuthenticatedRequest;
    userDetails: UserDetailsType,
    roomDetails: RoomDetailsType,
}


type valueOf<T> = T[keyof T];

type SocketPubKeysType = valueOf<typeof SocketPubEvents>;

export type RtcEventsKeysType = SocketPubKeysType

