import passport from 'passport';
import { User } from '../../models/user/user';
import { Strategy as LocalStrategy } from 'passport-local';
import { cookiePathAndNameGenerator } from '../../utils/cookies/cookies.utils';
import mongoose from 'mongoose';
import { logObject, logger } from '../logger/logger';

export function passportStrategies() {


   passport.use(
      new LocalStrategy(
         {
            usernameField: 'loginKey',
            passwordField: 'password',
            passReqToCallback: true,
         },
         async (req, loginKey, password, done) => {
            try {
               const { requestOrigin: role } = cookiePathAndNameGenerator(req.baseUrl);
               const isEmail = /\S+@\S+\.\S+/.test(loginKey);
               const errorMessage = isEmail
                  ? 'The email or password you entered is incorrect. Please try again.'
                  : 'The phone number or password you entered is incorrect. Please try again.';
               //reason because email and phone cannot be come at the same time one always undefined
               const filter = {
                  // provider: 'local',
                  $or: [{ email: loginKey }, { 'phone.number': loginKey }],
                  role: { $in: [role] },
               }
               const user = await User.findOne(filter);

               if (!user) {
                  return done(null, false, {
                     message: errorMessage,
                  });
               }
               const isMatch = user.compareBcryptPassword(password);

               if (!isMatch) {
                  return done(null, false, {
                     message: errorMessage,
                  });
               }

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
            logger.error('No user or user id to serialize', 'passport');
            return done(new Error('No user or user id to serialize'));
         }

         const userId = user.id;
         logger.debug(`Serializing user: ${userId}`, 'passport');

         done(null, userId);
      } catch (error) {
         logger.error('Serialization error', 'passport');
         logObject(error, 'passport');
         done(error);
      }
   });
   // Deserialize user from session
   passport.deserializeUser(async (id, done) => {
      try {
         logger.debug(`Deserializing user: ${id}`, 'passport');
         const payload = { _id: new mongoose.Types.ObjectId(id as string), id }
         done(null, payload);
      } catch (err) {
         logger.error('Deserialization error', 'passport');
         logObject(err, 'passport');
         done(err, null);
      }
   });
}
