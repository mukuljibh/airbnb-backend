// import mongoose from 'mongoose';
import { connect, connection } from 'mongoose';
import { Reservation } from '../models/reservation/reservation';
import { Property } from '../models/property/property';
import { User } from '../models/user/user';
import { Wishlist } from '../models/property/wishList';
import { Reviews } from '../models/property/reviews';
import { Price } from '../models/price/price';
import { poolJobs } from '../events/reservation/reservation.emitter';
// Enable Mongoose debug mode
// mongoose.set('debug', true);

const connectDatabase = async () => {
   try {
      if (!process.env.MONGO_URL) {
         throw new Error('MongoDB connection string is missing');
      }

      await Promise.all([
         connect(process.env.MONGO_URL),
         Reservation.syncIndexes(),
         Property.syncIndexes(),
         User.syncIndexes(),
         Wishlist.syncIndexes(),
         Reviews.syncIndexes(),
         Price.syncIndexes(),
      ]);

      console.log('Database connected successfully');
      await poolJobs(20);
      connection.once('open', async () => {
         console.log('MongoDB connection is open');
      });
   } catch (error) {
      console.error('Database connection error:', error);
      process.exit(1);
   }
};

export default connectDatabase;
