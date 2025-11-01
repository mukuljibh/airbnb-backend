import mongoose, { Document, Schema } from "mongoose";

interface IUserSelection {
    [key: string]: string;
}

interface IStep {
    stepNumber: number;
    pageName: string;
    userSelection: IUserSelection;
}

export interface IUserFlag extends Document {
    name: string;
    flaggableType: string;
    flaggableId: string;
    metaData: Record<string, any>;
    steps: IStep[];
    flaggingUserId: mongoose.Types.ObjectId;
    propertyId: mongoose.Types.ObjectId;
    submittedAt: Date;
}

const UserFlagSchema = new Schema<IUserFlag>(
    {
        name: { type: String, required: true },
        flaggableType: { type: String, required: true },
        flaggableId: { type: String, required: true },

        metaData: { type: Object, default: {} },
        steps: [
            {
                stepNumber: Number,
                pageName: String,
                userSelection: Schema.Types.Mixed,
            },
        ],
        flaggingUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
        submittedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export const UserFlagModel = mongoose.model<IUserFlag>("UserFlag", UserFlagSchema);
