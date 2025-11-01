import mongoose from "mongoose";

export type IReviews = {
    reservationId: mongoose.Schema.Types.ObjectId,
    propertyId: mongoose.Schema.Types.ObjectId;
    userId: mongoose.Schema.Types.ObjectId;
    content: string;
    rating: number;
    reviewedAt: Date;
};