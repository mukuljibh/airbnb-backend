//--> subscriber event 
export const SocketSubEvents = {

    USER_TYPING: "user:typing",//--> no data need to pass just emit
    USER_READ: "user:read",//--->no data need to send just send that uptil current message is read
    // USER_ACK_ONLINE: "user:ack-online",

    ROOM_LEFT: "room:left",
    //chat events
    CHAT_INTIALIZATION: "chat:init",
    CHAT_MESSAGE: "chat:message",
    DISCONNECT: "disconnect"

}
//--> publisher event 

export const SocketPubEvents = {

    USER_ACK_READ: "user:ack-read",//server will publish the event when other party read the message
    USER_ONLINE: "user:status",//server will will publish the event when other party join the room

    USER_ACK_TYPING: "user:ack-typing",//server will publish the event when other party start typing

    //room events
    ROOM_JOIN: "room:join",
    ROOM_LEFT: "room:left",


    //chat events
    CHAT_MESSAGE: "chat:message",
    CHAT_STORED: "chat:stored",

    //notification

    NOTIFICATION_ALERT: "notification:alert",
    NOTIFICATION_ACK_REGISTER: "notification:ack-register",

    //error
    ERROR: "error"

} as const


export const allSessionKeyVariable = ["roomDetails", "userDetails", "sessionOptions"] as const