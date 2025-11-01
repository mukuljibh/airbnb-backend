import mongoose from 'mongoose';
import { Types } from 'mongoose';

export interface IRoomQuery {
    _id?: Types.ObjectId;
    roomId?: Types.ObjectId;  // reference to Room
    checkIn?: Date;
    checkOut?: Date;
    adults?: number;
    children?: number;
    currency?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const roomQuerySchema = new mongoose.Schema<IRoomQuery>({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'room',
        // required: true,
    },
    checkIn: Date,
    checkOut: Date,
    adults: Number,
    children: Number,
    currency: {
        type: String,
        trim: true,
        lowercase: true,
    }
}, { timestamps: true });

roomQuerySchema.index({ roomId: 1 });

export const RoomQuery = mongoose.model('RoomQuery', roomQuerySchema);
