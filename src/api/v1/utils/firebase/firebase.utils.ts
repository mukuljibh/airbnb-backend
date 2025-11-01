import admin from "../../config/firebase/firebaseAdmin";
import { logger } from "../../config/logger/logger";
import { NotificationRecipient } from "../../controllers/common/notifications/services/dispatch.service";



export function subscribeToFirebaseNotifications(fcmToken: string, userId: string) {

    const key = `user_${userId}`
    logger.debug(`${userId} subscribe to this topic: ${key}`, 'firebase subscription');
    admin.messaging().subscribeToTopic(fcmToken, key)
        .catch(() => console.log(`error subscribing to topic ${key}.`))

}

export function unsubscribeToFirebaseNotifications(fcmToken: string, userId: string) {

    const key = `user_${userId}`
    logger.debug(`${userId} unsubscribe from this topic: ${key}`, 'firebase subscription');
    admin.messaging().unsubscribeFromTopic(fcmToken, key)
        .catch(() => console.log(`error unsubscribing to topic  ${key}.`))
}



export async function sendFirebaseNotification(topicKey: string, payload: NotificationRecipient) {
    try {
        const stringPayload = stringifyPayload(payload);

        const response = await admin.messaging().send({
            topic: topicKey,
            notification: {
                title: payload?.title || '',
                body: payload?.message || '',
            },
            data: stringPayload || {},
        });

        console.log(`Firebase notification sent to topic: ${topicKey}`);
        console.log(`Message ID: ${response}`);
    } catch (err) {
        console.error(`Error sending Firebase notification to topic "${topicKey}":`, err);
    }
}

function stringifyPayload(payload: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key in payload) {
        const value = payload[key];
        if (value !== undefined) {
            result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
    }
    return result;
}
