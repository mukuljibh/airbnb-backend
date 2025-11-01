import { emailEmitter } from '../../../../events/email/email.emitter';
import { notificationEmitter } from '../../../../events/notification/notification.emitter';
import { NotificationKeys, notificationMetaDataType } from '../types/notification.types';
import { sendFirebaseNotification } from '../../../../utils/firebase/firebase.utils';
import { templates } from '../../../../utils/email-service/emailServices.constant';
import { Role } from '../../../../models/user/types/user.model.types';
type NotificationChannel = 'email' | 'inApp' | 'both'

export type NotificationRecipient = {

   //--> in App attributes 
   userId: string;
   channels: NotificationChannel[];
   title: string;
   message: string;
   visibleToRoles: Role[];
   metadata: Record<string, unknown>;
   redirectKey?: string;

   //--> email attributes
   destination: string;
   replacement: Record<string, unknown>;
   type: keyof typeof templates;
};

type DispatchPayload = {
   recipients: NotificationRecipient[];
};


export function dispatchNotification({ recipients }: DispatchPayload) {
   try {
      recipients.forEach((r) => {
         const isEmail = r.channels.includes('email') || r.channels.includes('both');
         const isInApp = r.channels.includes('inApp') || r.channels.includes('both');


         if (isEmail && r.destination && r.type && r.replacement) {
            emailEmitter.emit('email:send', {
               type: r.type,
               destination: r.destination,
               replacement: r.replacement,
            });
         }

         if (isInApp && r.userId) {
            const inAppPayload = {
               userId: r.userId,
               title: r.title,
               message: r.message,
               redirectKey: r.redirectKey,
               metadata: r.metadata,
               visibleToRoles: r.visibleToRoles,
            } as NotificationRecipient

            notificationEmitter.emit('notification:send', inAppPayload);

            const topicKey = `user_${r.userId}`;
            sendFirebaseNotification(topicKey, inAppPayload);
         }
      });

   }
   catch (err) {
      console.log('error starting dispatch notification service.')
   }

}


type TemplateKey = keyof typeof templates;
type ReplacementFor<K extends TemplateKey> = typeof templates[K]['replacement'];
type EmailRequiredProps<K extends TemplateKey = TemplateKey> = {
   type: K;
   destination: string;
   replacement: ReplacementFor<K>;
};



type InAppPayload<R extends NotificationKeys> = Pick<
   NotificationRecipient,
   'userId' | 'title' | 'message' | 'visibleToRoles'
> & {
   redirectKey: R,
   metadata: notificationMetaDataType<R>
};


type BothOptions<K extends TemplateKey, R extends NotificationKeys> = {
   emailOptions: EmailRequiredProps<K>;
   notificationOptions: InAppPayload<R>;
};


type BaseForChannel<C extends NotificationChannel, K extends TemplateKey, R extends NotificationKeys> =
   C extends 'email' ? EmailRequiredProps<K> :
   C extends 'inApp' ? InAppPayload<R> :
   C extends 'both' ? BothOptions<K, R> :
   never;



type IOptions<
   C extends NotificationChannel,
   K extends TemplateKey,
   R extends NotificationKeys

> = BaseForChannel<C, K, R>

export function createRecipient<
   C extends NotificationChannel,
   K extends TemplateKey,
   R extends NotificationKeys

>(channel: C, options: IOptions<C, K, R>) {

   let finalOptions;

   switch (channel) {
      case 'email':
      case 'inApp':
         finalOptions = { ...options, channels: [channel] }
         break;

      case 'both': {
         const { emailOptions, notificationOptions } = options as IOptions<'both', K, R>;
         finalOptions = {
            ...emailOptions,
            ...notificationOptions,
            channels: ['inApp', 'email']
         }
         break;
      }
      default:
         throw new Error('invalid channel name for channel currently supported inApp | email | both')
   }

   return finalOptions as NotificationRecipient

}
