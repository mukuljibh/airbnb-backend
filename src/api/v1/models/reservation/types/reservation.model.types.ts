import mongoose, { Document } from 'mongoose';
import { IUser } from '../../user/types/user.model.types';

export interface IReservation extends Document {
   _id: mongoose.Types.ObjectId;
   reservationCode: string;
   hostId: mongoose.Types.ObjectId | IUser;
   userId: mongoose.Types.ObjectId | IUser;
   propertyId: mongoose.Schema.Types.ObjectId;
   payOutStatus: "unpaid" | "paid" | "cancelled",
   payOutId: mongoose.Types.ObjectId,
   checkInDate: Date;
   checkOutDate: Date;
   blockReason: string;
   numberOfGuests: number;
   isSelfBooked: boolean;
   cancellationReason?: string;
   priceData: {
      price: Number,
      currency: String
   }
   cancelledBy: 'host' | 'guest';
   totalPrice: Number,
   cancelledAt: Date;
   createdAt: Date;
   updatedAt: Date
   expiresAt: Date;
   confirmedAt: Date;
   isInstantBooking: boolean;
   hostDecisionAt: Date;
   hostDecision: 'approved' | 'rejected'
   status: 'open' | 'complete' | 'cancelled' | 'processing' | 'awaiting_confirmation';
   removeExpiration: () => Promise<void>;
}

export interface IBillingAddress {
   name: string;
   email: string;
   phone?: string;
   country: string;
   city: string;
   state: string;
   line1: string;
   line2?: string;
   postalCode: string;
}
