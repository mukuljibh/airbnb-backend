import { IUser } from "../../../../models/user/types/user.model.types";

export function shouldSendBasedOnSettings(
    category,
    settings: IUser['notificationSettings'],
) {
    switch (category) {
        case 'system':
        case 'reservation':
            return settings?.accountActivity ?? true;
        case 'user_query':
            return settings.messages ?? true;
        case 'promo':
            return settings?.travelTips ?? true;
        default:
            return true;
    }
}