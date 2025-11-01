import { SocketServerType } from "../types/rtc.types";



export function verifySession(socket: SocketServerType, event: string) {

    // console.log(`handler registered for verifySession event ${event}`);

    const userDetails = socket?.userDetails
    // const roomDetails = socket?.roomDetails
    if (!userDetails?.userId) {
        throw new Error(`unauthorized access caught on this : ${event}`)
    }

    // if (!roomDetails) {
    //     throw new Error("please join room to run this service")
    // }

}


