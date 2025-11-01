import EventEmitter from 'events';
import { sendEmail } from '../../utils/email-service/emailServices.utils';

export const emailEmitter = new EventEmitter();

emailEmitter.on('email:send', ({ type, destination, replacement }) => {
   setImmediate(() => sendEmail(type, destination, replacement));
});
