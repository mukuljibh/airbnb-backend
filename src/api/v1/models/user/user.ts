import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';
import { IUser } from './types/user.model.types';
import { ApiError } from '../../utils/error-handlers/ApiError';
import { decodeJwtToken } from '../../controllers/common/user/utils/common.user.utils';
const UserSchema = new Schema<IUser>(
   {
      firstName: String,
      lastName: String,
      profilePicture: String,
      hasEmailVerified: {
         type: Boolean,
         default: false,
      },
      hasPhoneVerified: {
         type: Boolean,
         default: false,
      },
      hasBasicDetails: {
         type: Boolean,
         default: false,
      },
      email: { type: String, lowercase: true, trim: true },
      contactEmail: String,
      dob: Date,
      googleId: String,
      facebookId: String,
      provider: {
         type: String,
         default: 'local',
      },
      phone: {
         country: String,
         countryCallingCode: String,
         number: String,
      },
      password: String,
      role: {
         type: [String],
         enum: ['guest', 'admin', 'host'],
         default: ['guest'],
      },
      isSoftDelete: {
         type: Boolean,
         default: false,
      },
      address: {
         flatNo: String,
         city: { type: String },
         street: { type: String },
         area: { type: String },
         landmark: { type: String },
         state: { type: String },
         country: { type: String, default: 'Dubai' },
         pincode: { type: String },
      },
      bio: String,
      languages: {
         type: [String],
      },
      verification: {
         id: String,
         status: {
            type: String,
            enum: ['canceled', 'processing', 'requires_input', 'verified'],
         },
      },
      session: {
         otpSessionId: String,
         otpToken: String,
         expire: Date,
      },
      expiresAt: {
         type: Date,
      },
   },
   { timestamps: true },
);

UserSchema.pre('save', async function (next) {
   if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, 10);
   }
   if (this.isModified('hasBasicDetails')) {
      this.expiresAt = null;
   }
   next();
});

// delete document after 1 day if basic profile not completed
UserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

UserSchema.methods.compareBcryptPassword = function (password: string) {
   return bcrypt.compareSync(password, this.password);
};

UserSchema.methods.createSession = async function (
   sessionId: string,
   type: string,
) {
   // Generate a 6-digit OTP
   // const otp = Math.floor(100000 + Math.random() * 900000).toString();
   const otp = '123456';
   // Hash the OTP
   const hashedOtp = await bcrypt.hash(otp, 10);

   // Set session expiry (15 minutes from now)
   //setting current time to expire the entire document after 15 minute as per ttl index if has_profile is not true
   this.expiresAt =
      type == 'SIGN_UP_OTP' ? new Date(Date.now() + 15 * 60 * 1000) : null;

   // Update the session in the document
   this.session = {
      otpSessionId: sessionId,
      otpToken: hashedOtp,
   };

   // Save the document
   await this.save();

   // Return unhashed OTP and session ID for immediate use
   return {
      otp: otp,
      sessionId: sessionId,
   };
};

UserSchema.methods.verifyOtp = async function (
   providedOtp: string,
   verificationFlag: 'hasEmailVerified' | 'hasPhoneVerified',
) {
   const otpSessionIdToken = this.session?.otpSessionId;
   const otpToken = this.session.otpToken;

   if (!otpSessionIdToken) {
      throw new ApiError(400, 'No active session found');
   }
   if (!decodeJwtToken(otpSessionIdToken).data) {
      this.session = undefined;
      throw new ApiError(400, 'it seems session got expired.', {
         step: 'login',
      });
   }

   // Verify OTP
   const isValid = await bcrypt.compare(providedOtp, otpToken);
   if (isValid) {
      this.session = undefined;
      this[verificationFlag] = true;
      await this.save();
   }

   return isValid;
};

UserSchema.methods.updatePassword = async function (newPassword: string) {
   this.password = newPassword;
   await this.save();
};

export const User = model('User', UserSchema);
