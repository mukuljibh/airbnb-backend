import { Types } from "mongoose";
import { Notification } from "../../../../models/notification/notification";
import { IPaginationAttributes } from "../../../../utils/pagination/pagination.types";
import { formatPaginationResponse } from "../../../../utils/pagination/pagination.utils";
import { User } from "../../../../models/user/user";
import { shouldSendBasedOnSettings } from "../helpers/notification.helper";

export const markAsRead = async (
    action: "multiple" | "single",
    userId: Types.ObjectId,
    notificationId?: Types.ObjectId
) => {
    if (action == "single") {
        return await Notification.updateOne(
            {
                _id: notificationId,
                userId,
            },
            { $set: { isRead: true } },
        );
    }

    return Notification.updateMany(
        { userId },
        { $set: { isRead: true } },

    );
};

export const deleteNotification = async (
    action: "multiple" | "single",
    userId: Types.ObjectId,
    notificationId?: Types.ObjectId
) => {
    if (action == "single") {
        return Notification.deleteOne({ _id: notificationId, userId });
    }
    return Notification.deleteMany({ userId });
};

export const fetchNotifications = async (
    filter: Record<string, unknown>,
    pagination: IPaginationAttributes
) => {
    const { startIndex: skip, limit } = pagination

    const [notifications, total] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Notification.countDocuments(filter),
    ]);
    return formatPaginationResponse(notifications, total, pagination)
}

export async function sendNotification({
    userId,
    title,
    message,
    visibleToRoles,
    category,
    relatedDocId,
    relatedModel,
    metadata,
    redirectKey
}) {
    try {
        const user = await User.findById(userId).lean();
        if (!user) return;
        const settings = user.notificationSettings;

        const shouldSend = shouldSendBasedOnSettings(category, settings);
        if (!shouldSend) return;
        await Notification.create({
            userId,
            title,
            message,
            visibleToRoles,
            category,
            relatedDocId,
            relatedModel,
            redirectKey,
            metadata,
        });
    } catch (err) {
        console.error('Error sending notification:', err.message);
    }
}
