import { Reservation } from "../../../../../models/reservation/reservation";
import { IUser } from "../../../../../models/user/types/user.model.types";
import { handleCancelOrder, IHandleCancel } from "../../services/payment.service";
import moment from "moment";
import { createRecipient, dispatchNotification } from "../../../../common/notifications/services/dispatch.service";
import { getAllReservationDetails } from "../../../../../repository/reservation.repo";



export async function autoCancelReservation(job) {
    const { reservationId } = job.attrs.data;

    try {
        const reservation = await Reservation.findOne({ _id: reservationId, status: 'awaiting_confirmation' })

        if (!reservation) {
            console.log('No reservation found')
            return
        }
        const cancelledBy = 'system'
        const reason = "Your reservation was automatically cancelled as the host did not confirm within the 1-hour confirmation period.";

        const filter = {
            _id: reservationId,
            status: { $in: ["awaiting_confirmation"] },
            userId: reservation.userId,
            hostId: reservation.hostId,
        }

        const options = {
            filter,
            userId: reservation.userId,
            cancelledBy,
            reason

        } as IHandleCancel

        if (!reservation?.isInstantBooking) {
            handleCancelOrder(options)
                .catch(() => console.log('error cancelling booking'))
        }

        await job.remove();

    }
    catch (err) {
        console.log(err)
        throw err;

    }

}


export async function generateBillingReceipt(job) {

    const { reservationId } = job.attrs.data;

    try {

        const reservation = await getAllReservationDetails({ _id: reservationId, status: { $ne: 'open' } })

        if (!reservation) {
            console.warn('No  reservation found to generate billing email')
            return
        }

        const payload = {
            ...reservation.billingDetails,
            ...reservation.reservationDetails,
            ...reservation.hostDetails,
            ...reservation.propertyDetails,
            ...reservation.guestDetails
        }

        const { guestDetails } = reservation

        const emailPayload = createRecipient('email', {
            destination: guestDetails.guestEmail,
            type: 'RESERVATION_RECIEPTS',
            replacement: payload as any
        })

        dispatchNotification({ recipients: [emailPayload] })

        await job.remove();

    }
    catch (err) {
        console.log(err)
        throw err;

    }

}



export async function reservationReviewRequest(job) {

    const { reservationId } = job.attrs.data;

    try {
        const reservation = await Reservation.findOne({ reservationId })
            .populate<{ hostId: IUser }>('hostId', 'firstName email')
            .populate<{ userId: IUser }>('userId', 'firstName email')
            .select('hostId userId');


        if (!reservation) {
            console.warn('RESERVATION_REVIEW_REQUEST skiped no reservation found.')
            return
        }

        const host = reservation.hostId
        const user = reservation.userId


        const emailPayload = createRecipient('email', {
            destination: user.email,
            type: 'RESERVATION_REVIEW_REQUEST',
            replacement: { hostName: host.firstName }
        })

        dispatchNotification({ recipients: [emailPayload] })

        await job.remove();

    }
    catch (err) {
        console.log(err)
        throw err;

    }

}


export async function generateReservationConfirmationNotification(job) {
    const { reservationId } = job.attrs.data;

    const reservation = await getAllReservationDetails({ _id: reservationId, status: { $ne: 'open' } })

    if (!reservation) {
        console.warn('No  reservation found to generate billing email')
        return
    }

    const payload = {
        ...reservation.billingDetails,
        ...reservation.reservationDetails,
        ...reservation.hostDetails,
        ...reservation.propertyDetails,
        ...reservation.guestDetails
    }

    const { guestDetails, hostDetails, propertyDetails, reservationDetails } = reservation

    const { guestId, guestEmail, } = guestDetails
    const { hostId, hostName } = hostDetails
    const { propertyName } = propertyDetails
    const { checkInDate, checkOutDate, isInstantBooking, concatDates } = reservationDetails


    const reservationTitle = isInstantBooking
        ? `Confirmed: Your reservation for ${concatDates}`
        : `Pending: Waiting for host confirmation`

    const reservationMessage = isInstantBooking
        ? `Great news! Your reservation is confirmed. We've sent you a confirmation email with all the details.`
        : `We’ve received your request and payment details. 
                Now we’re waiting for ${hostName} to confirm that the dates are really available. 
                You’ll be notified once the host accepts your booking.`



    // guest-->  gets both in-app + email
    const payload1 = createRecipient('both', {

        emailOptions: {
            destination: guestEmail,
            type: 'RESERVATION_CONFIRMATION',
            replacement: { ...payload, reservationTitle, reservationMessage } as any,
        },
        notificationOptions: {
            redirectKey: "reservation-page",
            metadata: { reservationId },
            userId: String(guestId),
            title: isInstantBooking
                ? 'Booking Confirmed'
                : 'Booking Request Pending',
            message: isInstantBooking
                ? 'Your booking has been successfully confirmed!'
                : 'Your booking request has been sent to the host. You’ll be notified once they confirm.',
            visibleToRoles: ['guest'],
        }

    });

    // notfication for host  gets in-app only
    const payload2 = createRecipient('inApp', {
        redirectKey: "reservation-page",
        metadata: { reservationId },
        userId: String(hostId),
        title: isInstantBooking
            ? 'Booking Confirmed'
            : 'Booking Request Pending',
        message: isInstantBooking
            ? `A new booking has been successfully confirmed for your property "${propertyName}" from ${checkInDate} to ${checkOutDate}.`
            : `You have received a new booking request for your property "${propertyName}" from ${checkInDate} to ${checkOutDate}. Please review and confirm to complete the reservation.`,
        visibleToRoles: ['host'],
    });
    const notificationPayload = [payload1, payload2]


    dispatchNotification({ recipients: notificationPayload })


    await job.remove();

}


