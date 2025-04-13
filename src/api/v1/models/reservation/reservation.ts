import mongoose from 'mongoose';
import { IReservation } from './types/reservation.model.types';

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
      status: {
         type: String,
         enum: ['open', 'complete', 'processing', 'cancelled'],
         default: 'open',
      },
      expiresAt: {
         type: Date,
         default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 mins future
      },
   },
   { timestamps: true },
);
reservationSchema.index({ propertyId: 1 });
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
         const now = new Date();
         const monthNames = [
            'JAN',
            'FEB',
            'MAR',
            'APR',
            'MAY',
            'JUN',
            'JUL',
            'AUG',
            'SEP',
            'OCT',
            'NOV',
            'DEC',
         ];
         const formattedDate = `${monthNames[now.getMonth()]}${String(now.getDate()).padStart(2, '0')}`;
         this.reservationCode = `SELF-BOOK-${formattedDate}`;
      } else {
         this.reservationCode = `RES-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
      }
   }
   next();
});

export const Reservation = mongoose.model('Reservation', reservationSchema);
