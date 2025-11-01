import { connect, connection } from 'mongoose';
import { Reservation } from '../models/reservation/reservation';
import { Property } from '../models/property/property';
import { User } from '../models/user/user';
import { Wishlist } from '../models/wishlist/wishList';
import { Reviews } from '../models/reviews/reviews';
import { Price } from '../models/price/price';
import UserQuery from '../models/userQuery';
import { JobQueues } from '../models/jobQueues';
import { SessionStore } from '../models/session/SessionStore';
import { Billing } from '../models/reservation/billing';
import { Transaction } from '../models/reservation/transaction';
import env from './env';
// Enable Mongoose debug mode
// mongoose.set('debug', true);

const connectDatabase = async () => {
   try {
      if (!env.MONGO_URL) {
         throw new Error('MongoDB connection string is missing');
      }

      await Promise.all([
         connect(env.MONGO_URL),
         Reservation.syncIndexes(),
         Billing.syncIndexes(),
         Transaction.syncIndexes(),
         Property.syncIndexes(),
         User.syncIndexes(),
         Wishlist.syncIndexes(),
         Reviews.syncIndexes(),
         Price.syncIndexes(),
         UserQuery.syncIndexes(),
         JobQueues.syncIndexes(),
         SessionStore.syncIndexes(),
      ]);

      console.log('Database connected successfully');
      // await watchSessionCollection();

      connection.once('open', async () => {
         console.log('MongoDB connection is open');
      });
   } catch (error) {
      console.error('Database connection error:', error);
      process.exit(1);
   }
};

// async function watchSessionCollection() {
//    const db = mongoose.connection;
//    const sessionCollection = db.collection('sessions');

//    const changeStream = sessionCollection.watch([], {
//       fullDocument: 'updateLookup',
//    });

//    changeStream.on('change', (change) => {
//       console.log('Session collection change event:', change.operationType);
//    });

//    console.log('Listening to sessions collection...');
// }

export default connectDatabase;
