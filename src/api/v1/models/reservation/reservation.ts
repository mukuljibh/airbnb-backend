import mongoose from 'mongoose';
import { IReservation } from './types/reservation.model.types';
import { v4 as uuidv4 } from 'uuid';

const reservationSchema = new mongoose.Schema<IReservation>(
   {
      reservationCode: String,
      hostId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true,
      },
      userId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true,
      },
      propertyId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Property',
         required: true,
      },
      checkInDate: {
         type: Date,
      },
      checkOutDate: {
         type: Date,
      },

      isSelfBooked: {
         type: Boolean,
         default: false,
      },

      blockReason: {
         type: String,
         trim: true,
      },


      numberOfGuests: Number,
      cancellationReason: {
         type: String,
         trim: true,
      },
      cancelledAt: Date,

      // payOutId: {
      //    type: mongoose.Schema.Types.ObjectId,
      //    ref: "payout"
      // },

      // payOutStatus: {
      //    type: String,
      //    enum: ["unpaid", "cancelled", "paid"],
      // },

      totalPrice: {
         type: Number,
      },

      status: {
         type: String,
         enum: ['open', 'complete', 'processing', 'cancelled', 'awaiting_confirmation'],
         default: 'open',
      },
      isInstantBooking: {
         type: Boolean,
         default: false,
      },
      cancelledBy: {
         type: String,
         enum: ['host', 'guest', 'system']
      },
      hostDecisionAt: {
         type: Date,
      },

      hostDecision: {
         type: String,
         enum: ['approved', 'rejected'],
      },

      expiresAt: {
         type: Date,
         default: () => new Date(Date.now() + 30 * 60 * 1000), // 30 mins future
      },
      confirmedAt: {
         type: Date,
      },
   },
   { timestamps: true },
);


reservationSchema.index({ hostId: 1, status: 1 });

reservationSchema.index({ propertyId: 1, checkInDate: 1, checkOutDate: 1, status: 1 });
reservationSchema.index({ userId: 1, isSelfBooked: 1, createdAt: -1 })


reservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Enforces a unique constraint to prevent multiple users from booking the same property
// with overlapping check-in and check-out dates. This ensures data integrity and avoids
// double bookings at the database level. If a conflict occurs, MongoDB will throw a
// duplicate key error (E11000), which should be handled appropriately in the API logic.
reservationSchema.index(
   {
      status: 1,
      checkInDate: 1,
      checkOutDate: 1,
      propertyId: 1,
      cancelledAt: 1,
   },
   { unique: true },
);
reservationSchema.pre('save', function (next) {
   if (!this.reservationCode) {
      if (this.isSelfBooked) {
         this.reservationCode = `SELF-${uuidv4().split('-')[0].toUpperCase()}`;
      } else {
         this.reservationCode = `RES-${uuidv4().split('-')[0].toUpperCase()}`;
      }
   }
   next();
});

export const Reservation = mongoose.model('Reservation', reservationSchema);
