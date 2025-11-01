import { Schema } from "mongoose"

export const propertyGallerySchema = new Schema(
    {
        publicId: String,
        url: String,
        caption: String,
        isPrimary: Boolean,
    },
    { _id: false }
)
