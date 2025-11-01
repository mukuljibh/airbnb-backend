import { getAllReservationDetails } from "../../../../../repository/reservation.repo";
import { createRecipient, dispatchNotification } from "../../../../common/notifications/services/dispatch.service";




export async function reservationCancellationNotification(job) {
    const { reservationId } = job.attrs.data;

    const reservation = await getAllReservationDetails({ _id: reservationId, status: { $eq: 'cancelled' } })

    if (!reservation) {
        console.warn('No  reservation found to generate billing email')
        return
    }

    const { guestDetails, hostDetails, propertyDetails, reservationDetails, billingDetails } = reservation

    const { guestId, guestEmail } = guestDetails
    const { totalRefunded, currency } = billingDetails

    const { hostId, hostName } = hostDetails
    const { propertyName, thumbnail, propertyPlaceType } = propertyDetails
    const { checkInDate, checkOutDate, reservationCode, concatDates, cancelledBy } = reservationDetails


    const notificationPayload = []
    // Guest gets both in-app + email

    let message;
    let title;
    if (cancelledBy === 'guest') {
        title = 'Booking Cancelled';
        message = 'Your booking has been cancelled. We hope to host you another time.';
    } else if (cancelledBy === 'host') {
        title = 'Booking Cancelled by Host';
        message = `Your booking for "${propertyDetails.propertyName}" has been cancelled by the host. You will receive a refund if applicable.`;
    }


    const bookingCancelledPayload = createRecipient('both', {
        emailOptions: {
            destination: guestEmail,
            type: 'RESERVATION_CANCELLATION',
            replacement: {
                concatDates: reservationDetails.concatDates,
                propertyName: propertyDetails.propertyName,
                thumbnail: propertyDetails.thumbnail,
                reservationCode: reservationDetails.reservationCode,
                currency: billingDetails.currency,
                guestName: guestDetails.guestName,
                totalRefunded: billingDetails.totalRefunded,
                cancelledAt: reservationDetails.cancelledAt,
                propertyAddress: propertyDetails.propertyAddress,
                paymentCard: billingDetails.paymentCard,
                // cancellationReason: metadata?.cancellationReason,
            },
        },
        notificationOptions: {
            redirectKey: "reservation-page",
            metadata: { reservationId },
            userId: String(guestId),
            title,
            message,
            visibleToRoles: ['guest'],
        }
    });
    notificationPayload.push(bookingCancelledPayload)

    // Host gets in-app only when guest cancelled it.
    if (cancelledBy == 'guest') {
        const guestPayload = createRecipient('inApp', {
            redirectKey: "reservation-page",
            metadata: { reservationId },
            userId: String(hostId),
            title: 'Booking Cancelled',
            message: `The guest has cancelled their reservation for ${propertyName} originally scheduled from ${checkInDate} to ${checkOutDate}.`,
            visibleToRoles: ['host'],
        });
        notificationPayload.push(guestPayload)
    }

    // Guest gets email about refund
    const refundPayload = createRecipient('email', {
        type: 'REFUND_RECIEVED',
        destination: guestEmail,
        replacement: {
            thumbnail,
            propertyName,
            propertyPlaceType,
            hostName,
            formattedDateRange: concatDates,
            reservationCode,
            refundAmount: totalRefunded,
            currencySymbol: currency,
        },
    });

    notificationPayload.push(refundPayload)

    dispatchNotification({ recipients: notificationPayload })

    await job.remove()
}

