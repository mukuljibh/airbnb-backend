
type NotificationRedirectType = {
    "reservation-page": {
        reservationId: string
    },
    "user-page": {
        userId: string
    },
    "property-page": {
        propertyId: string
    },
    "new-property-request": {
        propertyId: string
    }
    "property-update-request": {
        updateId: string
        propertyId: string
    },
    "contact-support": {
        roomId: string;
        roomUniqueId: string,
    }
    'property-report-review': {

        flaggedProperty: {
            propertyId: string,
            propertyTitle: string,
        },
        reportedBy: {
            userId: string,
            name: string
        }

    }
};




export type NotificationKeys = keyof NotificationRedirectType

export type notificationMetaDataType<T extends NotificationKeys> = NotificationRedirectType[T]


