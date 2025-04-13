import EventEmitter from 'events';
import { sendEmail } from '../../utils/email-service/emailServices.utils';
import { sendNotification } from '../../utils/notification/notification.utils';

export const userEmitter = new EventEmitter();
userEmitter.on('user:otpGenerated', ({ type, destination, replacement }) => {
   setImmediate(() => sendEmail(type, destination, replacement));
});

userEmitter.on('user:welcome', ({ type, destination, replacement, userId }) => {
   setImmediate(() => {
      sendEmail(type, destination, replacement);
      sendNotification({
         userId: userId,
         title: 'Welcome to Airbnb!',
         type: 'system',
         message: 'Thanks for signing up. Start exploring unforgettable stays.',
         metadata: {
            action: 'userSignup',
            navigateTo: 'explorePage',
         },
         genericRef: userId,
         typeRef: 'user',
      });
   });
});

userEmitter.on(
   'user:property-list',
   ({ type, destination, replacement, userId, propertyId }) => {
      setImmediate(() => {
         sendEmail(type, destination, replacement);
         sendNotification({
            userId,
            title: 'Your property has been listed!',
            type: 'system',
            message: 'Your new property is now live and visible to travelers.',
            metadata: {
               action: 'propertyListed',
               navigateTo: 'hostPropertyPage',
            },
            genericRef: propertyId,
            typeRef: 'property',
         });
      });
   },
);
