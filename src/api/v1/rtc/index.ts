import { User } from "../models/user/user";
import { emitEvent } from "./helpers/rtc.helper";
import { SocketPubEvents } from "./chat/constant";
import { registerChatHandler } from "./chat/register";
import { SocketServerType } from "./types/rtc.types";

//this will be remove when we use redis, for used when client does not call disconnect
//it is optional if client follow the rule disconnect the chanel property for making everthing work as expected 
//imposed this setup of map for safety  on server.

export const connectedUsers = new Map<string, string>();

export function startWebRtcConections(io) {

    console.log(`rtc service connected `,)
    // const namespaceKey = 'guest'
    io.on('connection', async (socket: SocketServerType) => {
        try {
            const { requestOrigin, userId } = socket.sessionOptions
            if (!userId && requestOrigin) {
                throw new Error('requestOrigin and userId is missing from session aborting....')
            }

            // const oldSocketId = connectedUsers.get(token);
            // if (oldSocketId && oldSocketId !== socket.id) {
            //     const oldSocket = io.sockets.sockets.get(oldSocketId);
            //     if (oldSocket) {
            //         console.log(`⚠️ Duplicate connection detected for user ${userId}. Disconnecting old socket.`);
            //         oldSocket.disconnect(true);
            //     }
            // }
            // connectedUsers.set(token, socket.id);

            const user = await User.findById(userId).select('firstName profilePicture lastName role').lean()

            const { firstName, profilePicture, lastName, role } = user

            console.log(`Connected to ${requestOrigin}`)

            socket.userDetails = { firstName, lastName, profilePicture, userId: String(userId), role }
            //acknowledge client connection is ready you can start service.
            const notificationChanel = `${String(userId)}_${requestOrigin}`
            socket.join(notificationChanel)
            socket.emit("server-ready", `hi ${firstName} lets go you are in now. please call chat:init service.`)
            socket.emit(SocketPubEvents.NOTIFICATION_ACK_REGISTER, `You have successfully register for notification on this channel ${notificationChanel}`)

            //intialize chat service 
            registerChatHandler({ io, socket, connectedUsers })
        }
        catch (err) {

            console.log(err);

            emitEvent(socket, null, "error", {
                success: false,
                message: err?.message || "Something went wrong with the server "
            })

        }
    })
}