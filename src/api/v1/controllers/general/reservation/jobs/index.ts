import moment from "moment";
import { agenda } from "../../../../config/agenda";
import { reservationDefines } from "./defines/reservation.define";


interface IScheduleReservation {
    reservationId?: string,
    checkInDate?: Date,
    checkOutDate?: Date,
    status?: string,
    reservedAt?: Date,

}
export async function scheduleReservationConfirmationJobs(options: IScheduleReservation) {

    const { checkOutDate, reservationId, status } = options
    // const reservationCheckInDate = moment.utc(checkInDate).startOf('day').toDate()
    const reservationCheckOutDate = moment.utc(checkOutDate).startOf('day').toDate()
    if (status == 'awaiting_confirmation') {
        await agenda.schedule('in 1 hour', reservationDefines.AUTO_CANCEL_RESERVATION, { reservationId })
    }


    await agenda.now(reservationDefines.RESERVATION_CONFIRM_NOTIFICATION, { reservationId })

    await agenda.schedule('in 1 minute', reservationDefines.RESERVATION_RECEIPT, { reservationId })

    await agenda.schedule(reservationCheckOutDate, reservationDefines.RESERVATION_REVIEW_REQUEST, { reservationId })


}


export async function scheduleReservationCancellationJobs(options: IScheduleReservation) {

    const { reservationId } = options
    await agenda.schedule('in 30 seconds', reservationDefines.RESERVATION_CANCELLATION_NOTIFICATIONS, { reservationId })
}
