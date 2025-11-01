import { SocketServerType } from "../types/rtc.types";
import { emitEvent } from "../helpers/rtc.helper";


type IHandler = (data: unknown) => void | Promise<void>


export const errorHandler = (socket: SocketServerType, event: string) =>
    (handler: IHandler) =>
        async (data: unknown) => {
            try {
                console.log(`handler registered for event ${event}`);
                await handler(data);
            } catch (err: unknown) {
                // console.log({ err });

                let message = "Something went wrong";
                if (err instanceof Error) {
                    message = err.message;
                } else if (typeof err === "string") {
                    message = err;
                } else if (err && typeof err === "object" && "message" in err) {
                    message = (err as { message?: string })?.message;
                }

                emitEvent(socket, null, "error", {
                    success: false,
                    message,
                });
            }
        };
