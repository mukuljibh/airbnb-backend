import mongoose from 'mongoose';

const storeSessionSchema = new mongoose.Schema({
   _id: String,
   expires: Date,
   lastModified: Date,
   session: Object,
   userId: String,
   csrfToken: String
});

storeSessionSchema.index({ userId: 1 });
storeSessionSchema.index({ csrfToken: 1 });
storeSessionSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

export const SessionStore = mongoose.model('Session', storeSessionSchema);
