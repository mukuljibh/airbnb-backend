import { startWebRtcConections } from './api/v1/rtc';
import { startSocketEngine } from './socket';
import { Server } from './server';

//We can specify port number if we want otherwise port fetch from the env as per environment
const server = new Server();

const httpServer = server.start();

//starting socket server it will return the namepaces of web socket
const webSocketIO = startSocketEngine(httpServer)
startWebRtcConections(webSocketIO)

export { webSocketIO }

