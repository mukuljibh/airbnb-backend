
import { SocketServerType } from "../types/rtc.types";
import { createChatHandler } from "./handler";
import { errorHandler } from "../middleware/errorhandler";
import { verifySession } from "../middleware/verifySession";
import { SocketSubEvents } from "./constant";

export interface IChatHandler {
    //io is entire server
    io: SocketServerType,
    //socket is per user instance
    socket: SocketServerType,
    //it is temp map for <socketId,token> to dismissed redundant connection
    connectedUsers: Map<string, string>
}


function createChatController(options: IChatHandler) {

    const handler = createChatHandler(options);
    const { socket } = options;

    const chatSocketEvents = {
        [SocketSubEvents.CHAT_INTIALIZATION]: {
            handler: handler.intiatlizeChatSession,
            middleware: [errorHandler],
            verifySession: false
        },
        [SocketSubEvents.CHAT_MESSAGE]: {
            handler: handler.listenForMessages,
            middleware: [errorHandler],
            verifySession: true
        },
        [SocketSubEvents.USER_READ]: {
            handler: handler.listenForAcknowledgeMessageEvents,
            middleware: [errorHandler],
            verifySession: true

        },
        [SocketSubEvents.ROOM_LEFT]: {
            handler: handler.handleRoomLeft,
            middleware: [errorHandler],
            verifySession: true

        },
        [SocketSubEvents.USER_TYPING]: {
            handler: handler.listenForUserTyping,
            middleware: [errorHandler],
            verifySession: true

        },

        // [SocketSubEvents.USER_ACK_ONLINE]: {
        //     handler: handler.ackUserOnline,
        //     middleware: [errorHandler],
        //     verifySession: true
        // },

        [SocketSubEvents.DISCONNECT]: {
            handler: handler.handleSocketDisconnect,
            middleware: [errorHandler],
            verifySession: true

        },
    }

    const controller: Record<string, (data: unknown) => Promise<void>> = {};

    Object.entries(chatSocketEvents).forEach(([event, config]) => {

        const { handler, middleware, verifySession: requireSession } = config

        let wrappedHandler = async (data: unknown) => {
            if (requireSession) {
                verifySession(socket, event)
            }
            await handler(data);
        };
        if (middleware) {
            wrappedHandler = middleware.reduce(
                (prevHandler, mw) => mw(socket, event)(prevHandler),
                wrappedHandler
            );
        }

        controller[event] = wrappedHandler;
    });


    return controller;
}

export function registerChatHandler(options: IChatHandler) {
    const { socket } = options;
    const controller = createChatController(options);

    Object.entries(controller).forEach(([event, handler]) => {
        socket.on(event, handler);
    });
}