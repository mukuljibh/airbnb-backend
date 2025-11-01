import { Server as socketServer } from "socket.io";
import http from 'http';
import { SessionStore } from "./api/v1/models/session/SessionStore";
import { SocketServerType } from "./api/v1/rtc/types/rtc.types";
import { validateObjectId } from "./api/v1/utils/mongo-helper/mongo.utils";
import { Role } from "./api/v1/types/session/session";
import { NextFunction } from "express";
import { allowedOrigin } from "./api/v1/config/session/session.helper";


export function startSocketEngine(server: http.Server | null = null) {

    const io = new socketServer(server, {
        cors: {
            origin: true,
            credentials: true,
            methods: ["GET", "POST"]
        },
        pingTimeout: 60000,
        path: '/ws',
        transports: ['polling', 'websocket']
    });

    io.use(async (socket: SocketServerType, next: NextFunction) => {
        const requestOrigin = socket.handshake?.query?.requestOrigin as Role;
        const token = socket.handshake?.auth?.token;
        const isValidRequestPath = allowedOrigin.includes(requestOrigin);

        console.log("Socket handshake token:", token || 'Not provided');

        if (!isValidRequestPath) {
            console.log('Invalid request origin:', requestOrigin);
            return next(new Error('Authentication failed: request origin is not allowed.'));
        }

        if (!token) {
            console.warn(`Socket authentication failed on ${requestOrigin} — no token and no cookie`);
            return next(new Error('Authentication error'));
        }

        const sessionObject = await SessionStore.findOne({ csrfToken: token })
            .select('userId csrfToken')
            .lean()

        if (!sessionObject) {
            return next(new Error("Unauthenticated"))
        }

        socket.sessionOptions = { userId: validateObjectId(sessionObject.userId), requestOrigin, token: token };
        console.log("✅ Socket token authenticated via token:", socket.sessionOptions.userId);
        return next();

    });


    console.log("Socket.IO servers initialized for path:", '/ws');
    return io;
}