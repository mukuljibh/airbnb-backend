import mongoose, { Document } from 'mongoose';
import { USER_STATUS } from '../enums/user.enum';

export type Role = 'guest' | 'admin' | 'host';


type valueOf<T> = T[keyof T]

export type UserStatus = valueOf<typeof USER_STATUS>;

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
   isDeactivated: boolean;
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
   status: UserStatus

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
   notificationSettings: {
      hostingInsights: boolean;
      newsUpdates: boolean;
      travelTips: boolean;
      messages: boolean;
      reminders: boolean;
      accountActivity: boolean;
   };
   session?: {
      otpSessionId?: string;
      otpToken?: string;
      expire?: Date;
   };

   statusMeta?: {
      // Deletion can be done by admin  or user
      previousStatus: UserStatus,
      newStatus: UserStatus
      changedBy: {
         userId: string,
         role: 'admin' | 'user' | 'system'
      }
      timestamp: Date,
      reason: string
   }[],

   expiresAt?: Date;
   createdAt?: Date;
   updatedAt?: Date;
   deletionRequestedAt?: Date,
   deletedAt?: Date;

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
