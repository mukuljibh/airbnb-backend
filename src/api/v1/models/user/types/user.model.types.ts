import mongoose, { Document } from 'mongoose';

export type Role = 'guest' | 'admin' | 'host';
export interface IUser extends Document {
   _id: mongoose.Types.ObjectId;
   stripeCustomerId?: string;
   defaultPaymentMethod?: string;
   firstName?: string;
   lastName?: string;
   profilePicture?: string;
   hasEmailVerified?: boolean;
   hasPhoneVerified?: boolean;
   hasBasicDetails?: boolean;
   email?: string;
   contactEmail?: string;
   dob?: Date;
   googleId?: string;
   facebookId?: string;
   provider?: string;
   phone: {
      country: string;
      countryCallingCode: string;
      number: string;
   };
   password?: string;
   role?: Role[];
   isSoftDelete: boolean;
   address?: {
      flatNo?: string;
      city?: string;
      street?: string;
      area?: string;
      landmark?: string;
      state?: string;
      country?: string;
      pincode?: string;
   };

   verification: {
      id: string;
      status: 'canceled' | 'processing' | 'requires_input' | 'verified';
   };
   bio?: string;
   languages?: string[];
   session?: {
      otpSessionId?: string;
      otpToken?: string;
      expire?: Date;
   };
   expiresAt?: Date;
   createdAt?: Date;
   updatedAt?: Date;

   // Methods
   compareBcryptPassword(password: string): boolean;
   createSession(
      sessionId: string,
      type: string,
   ): Promise<{ otp: string; sessionId: string }>;
   verifyOtp(
      providedOtp: string,
      verificationFlag: 'hasEmailVerified' | 'hasPhoneVerified',
   ): Promise<boolean>;
   updatePassword(newPassword: string): Promise<void>;
}

export type ISessionUser = Pick<IUser, '_id'>;
