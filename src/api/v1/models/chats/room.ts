import mongoose from 'mongoose';

export type IConversationType = "guest-host" | "guest-admin" | "host-admin"

import { Types } from 'mongoose';



export interface IRoom {
    _id?: Types.ObjectId;
    roomUniqueId: string;
    propertyId?: Types.ObjectId;
    roomQueryId?: Types.ObjectId;
    queryDetails?: Types.ObjectId;
    conversationType?: IConversationType;
    roomCreatedAt?: Date;
    roomLastActive?: Date;
    members: Types.ObjectId[];
    roomReOpenAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;

}

const roomSchema = new mongoose.Schema<IRoom>({

    roomUniqueId: {
        type: String,
        required: true,
    },

    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'property',
    },
    roomQueryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RoomQuery',
    },
    queryDetails: {
        checkIn: Date,
        checkOut: Date,
        adults: Number,
        children: Number,
        currency: {
            type: String,
            trim: true,
            lowercase: true,
        }

    },

    conversationType: {
        type: String,
        enum: ["guest-host", "guest-admin", "host-admin"]
    },

    members: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "user",
    },
    roomCreatedAt: {
        type: Date,
        default: Date.now
    },
    roomLastActive: {
        type: Date,
        default: Date.now
    },
    roomReOpenAt: {
        type: Date
    }
}, { timestamps: true });

roomSchema.index({ senderId: 1, propertyId: 1, audiences: 1 });
roomSchema.index({ conversationType: 1 });

export const Room = mongoose.model('Room', roomSchema);
