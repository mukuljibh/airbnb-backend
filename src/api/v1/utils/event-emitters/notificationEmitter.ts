import EventEmitter from 'events';
import { sendEmail } from '../email-service/emailServices.utils';
export const notificationEmitter = new EventEmitter();

notificationEmitter.on(
   'auth:otpGenerated',
   ({ type, destination, replacement }) => {
      setImmediate(() => sendEmail(type, destination, replacement));
   },
);

notificationEmitter.on('user:welcome', ({ type, destination, replacement }) => {
   setImmediate(() => sendEmail(type, destination, replacement));
});

notificationEmitter.on(
   'user:property-list',
   ({ type, destination, replacement }) => {
      setImmediate(() => sendEmail(type, destination, replacement));
   },
);
