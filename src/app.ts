import { Server } from './server';

//We can specify port number if we want otherwise port fetch from the env as per environment
const server = new Server();
server.start();
