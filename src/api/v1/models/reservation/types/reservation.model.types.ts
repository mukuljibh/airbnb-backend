import mongoose from 'mongoose';
import { IUser } from '../../user/types/user.model.types';

export interface IReservation extends Document {
   _id: mongoose.Types.ObjectId;
   reservationCode: string;
   hostId: mongoose.Types.ObjectId | IUser;
   userId: mongoose.Types.ObjectId | IUser;
   propertyId: mongoose.Schema.Types.ObjectId;
   checkInDate: Date;
   checkOutDate: Date;
   blockReason: string;
   numberOfGuests: number;
   isSelfBooked: boolean;
   cancellationReason?: string;
   cancelledAt: Date;
   createdAt: Date;
   expiresAt: Date;
   status: 'open' | 'complete' | 'cancelled' | 'processing';
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
