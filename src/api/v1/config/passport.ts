import passport from 'passport';
import passportGoogle from 'passport-google-oauth20';
import { User } from '../models/user/user';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { cookiePathAndNameGenerator } from '../utils/cookies/cookies.utils';
import mongoose from 'mongoose';

const GoogleStrategy = passportGoogle.Strategy;

export function passportConfig() {
   // Google OAuth strategy
   passport.use(
      new GoogleStrategy(
         {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            proxy: true,
            callbackURL: `${process.env.SERVER_URL}/api/v1/auth/google/callback`,
         },
         async (_accessToken, _refreshToken, profile, done) => {
            try {
               // Check if user exists with Google ID
               let user = await User.findOne({ googleId: profile.id });

               if (!user) {
                  // If user doesn't exist, create a new one
                  user = new User({
                     firstName: profile.name.givenName,
                     lastName: profile.name.familyName,
                     hasEmailVerified: true,
                     hasBasicDetails: true,
                     email: profile.emails?.[0]?.value || null,
                     googleId: profile.id,
                     provider: 'google',
                  });
                  await user.save();
               }

               // Pass the user object to Passport
               return done(null, user);
            } catch (err) {
               return done(err, null);
            }
         },
      ),
   );
   passport.use(
      new FacebookStrategy(
         {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: `${process.env.SERVER_URL}/api/v1/auth/facebook/callback`,
            profileFields: ['id', 'emails', 'name'],
            proxy: true, // Trust the proxy
         },
         async (accessToken, refreshToken, profile, done) => {
            console.log(profile);
            try {
               // Check if user exists
               let user = await User.findOne({ facebookId: profile.id });

               if (!user) {
                  // If user doesn't exist, we create a new one
                  user = new User({
                     facebook_id: profile.id,
                     firstName: profile.name?.givenName,
                     hasEmailVerified: true,
                     hasBasicDetails: true,
                     lastName: profile.name?.familyName,
                     email: profile.emails?.[0]?.value || null,
                     provider: 'facebook',
                  });
                  await user.save();
               }

               // Pass the user object to Passport
               return done(null, user);
            } catch (err) {
               return done(err, null);
            }
         },
      ),
   );
   // Local strategy
   passport.use(
      new LocalStrategy(
         {
            usernameField: 'loginKey', // Specify the field for email
            passwordField: 'password', // Specify the field for password
            passReqToCallback: true,
         },
         async (req, loginKey, password, done) => {
            try {
               // Find user by email
               const { role } = cookiePathAndNameGenerator(req.baseUrl);

               const isEmail = /\S+@\S+\.\S+/.test(loginKey);
               const errorMessage = isEmail
                  ? 'Invalid email or password.'
                  : 'Invalid phone number or password.';
               //reason because email and phone cannot be come at the same time one always undefined
               const user = await User.findOne({
                  provider: 'local',
                  $or: [{ email: loginKey }, { 'phone.number': loginKey }],
                  role: { $in: [role] },
               });
               if (!user) {
                  return done(null, false, {
                     message: errorMessage,
                  });
               }
               // Check if password is correct
               const isMatch = user.compareBcryptPassword(password);
               if (!isMatch) {
                  return done(null, false, {
                     message: errorMessage,
                  });
               }

               // Authentication successful
               return done(null, user);
            } catch (err) {
               return done(err);
            }
         },
      ),
   );

   // Serialize user to store in session

   passport.serializeUser((user: { id: string }, done) => {
      try {
         if (!user) {
            return done(new Error('No user or user id to serialize'));
         }
         const userId = user.id;
         console.log('Serializing user:', userId);
         done(null, userId);
      } catch (error) {
         console.error('Serialization error:', error);
         done(error);
      }
   });
   // Deserialize user from session
   passport.deserializeUser(async (id, done) => {
      try {
         console.log('deserialize user:', id);
         done(null, { _id: new mongoose.Types.ObjectId(id as string), id });
      } catch (err) {
         done(err, null);
      }
   });
}
