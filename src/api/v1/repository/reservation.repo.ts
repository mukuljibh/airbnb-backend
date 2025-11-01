import mongoose from "mongoose";
import { Reservation } from "../models/reservation/reservation";
import { IProperty, IPropertyRules } from "../models/property/types/property.model.types";
import { IUser } from "../models/user/types/user.model.types";
import { Billing } from "../models/reservation/billing";
import { Transaction } from "../models/reservation/transaction";
import { concatCurrencyWithPrice } from "../utils/currency/currency.utils";
import { concatTwoDates, formatDate } from "../utils/dates/dates.utils";


export async function getAllReservationDetails(options: { status?: any, _id: mongoose.Types.ObjectId }) {
    const matchFilter = {
        status: { $ne: 'open' },
        ...options,
    };

    const reservation = await Reservation.findOne(matchFilter)
        .populate<{
            propertyId: Omit<IProperty, 'propertyRules'> & { propertyRules: IPropertyRules }
        }>({
            path: 'propertyId',
            select: 'title thumbnail propertyPlaceType location propertyRules',
            populate: {
                path: 'propertyRules',
                select: 'checkInTime checkOutTime',
            }
        })
        .populate<{ userId: IUser, hostId: IUser }>(
            'userId hostId',
            'firstName email contactEmail'
        )
        .lean();

    if (!reservation) {
        console.warn('No reservation found to generate billing email');
        return null;
    }

    const reservationId = reservation._id;

    const [billing, transaction] = await Promise.all([
        Billing.findOne({ reservationId }).lean(),
        Transaction.findOne({ reservationId }).lean()
    ]);

    if (!billing) throw new Error('Billing not found');
    if (!transaction) throw new Error('Transaction not found');

    const {
        reservationCode, confirmedAt, propertyId: property,
        userId: guestUser, hostId: hostUser,
        numberOfGuests, checkInDate, checkOutDate, isInstantBooking, cancelledBy
    } = reservation;

    const {
        _id: billingId, subTotal, numberOfNights, billingCode,
        pricePerNight, discounts, currency, additionalFees, totalAmountPaid, totalbasePrice, totalRefunded
    } = billing;

    const { paymentMethod } = transaction;
    // console.log({ s: property });

    const { checkInTime, checkOutTime } = property.propertyRules ?? {};
    const { cleaning, platformFees, service, tax } = additionalFees ?? {};

    return {
        propertyDetails: {
            propertyName: property.title,
            thumbnail: property.thumbnail,
            propertyAddress: property.location?.address,
            propertyPlaceType: property.propertyPlaceType,
            checkInTime,
            checkOutTime
        },
        hostDetails: {
            hostId: hostUser._id,
            hostName: hostUser.firstName,
            hostEmail: hostUser.email
        },
        guestDetails: {
            guestId: guestUser._id,
            guestName: guestUser.firstName,
            guestEmail: guestUser.email || guestUser.contactEmail,
        },
        reservationDetails: {
            confirmedAt: formatDate(confirmedAt, false),
            reservationCode,
            concatDates: concatTwoDates(checkInDate, checkOutDate),
            checkInDate: formatDate(checkInDate, true),
            checkOutDate: formatDate(checkOutDate, true),
            billingCode,
            numberOfGuests,
            numberOfNights,
            isInstantBooking,
            cancelledBy,
            cancelledAt: formatDate(reservation.cancelledAt, true),
        },
        billingDetails: {
            pricePerNight: concatCurrencyWithPrice(currency, pricePerNight),
            cleaningFees: concatCurrencyWithPrice(currency, cleaning),
            paymentCard: `${paymentMethod?.brand?.toUpperCase()} •••• ${paymentMethod.last4}`,
            tax: concatCurrencyWithPrice(currency, tax),
            discounts: concatCurrencyWithPrice(currency, discounts),
            platformFees: concatCurrencyWithPrice(currency, platformFees),
            serviceFees: concatCurrencyWithPrice(currency, service),
            subTotal: concatCurrencyWithPrice(currency, subTotal),
            currency: currency?.toUpperCase(),
            totalBasePrice: concatCurrencyWithPrice(currency, totalbasePrice),
            totalAmountPaid: concatCurrencyWithPrice(currency, totalAmountPaid),
            totalRefunded: concatCurrencyWithPrice(currency, totalRefunded)
        }
    };
}


export type ReservationType = Awaited<ReturnType<typeof getAllReservationDetails>>;
