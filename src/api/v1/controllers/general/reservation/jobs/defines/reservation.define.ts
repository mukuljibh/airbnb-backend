import { agenda } from "../../../../../config/agenda";
import * as reservationConfirmHandler from '../handlers/confirmation.handler'
import * as reservationCancellationHandler from '../handlers/cancellation.handler'





export const reservationDefines = {
    AUTO_CANCEL_RESERVATION: 'auto_cancel_reservation',
    RESERVATION_CONFIRMED: 'reservation_confirmation',
    RESERVATION_REVIEW_REQUEST: 'reservation_review',
    RESERVATION_CONFIRM_NOTIFICATION: 'reservation_confirm_notification',
    RESERVATION_RECEIPT: 'reservation_receipt',
    RESERVATION_CANCELLATION_NOTIFICATIONS: 'reservation_cancellation_notification'

}

agenda.define(reservationDefines.AUTO_CANCEL_RESERVATION, { lockLifetime: 60000 }, reservationConfirmHandler.autoCancelReservation);

agenda.define(reservationDefines.RESERVATION_RECEIPT, { lockLifetime: 120000 }, reservationConfirmHandler.generateBillingReceipt);

agenda.define(reservationDefines.RESERVATION_REVIEW_REQUEST, { lockLifetime: 60000 }, reservationConfirmHandler.reservationReviewRequest);

agenda.define(reservationDefines.RESERVATION_CONFIRM_NOTIFICATION, { lockLifetime: 60000 }, reservationConfirmHandler.generateReservationConfirmationNotification);

agenda.define(reservationDefines.RESERVATION_CANCELLATION_NOTIFICATIONS, { lockLifetime: 60000 }, reservationCancellationHandler.reservationCancellationNotification);


