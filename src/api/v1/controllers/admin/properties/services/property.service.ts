import mongoose from "mongoose";
import { AmenitiesTag } from "../../../../models/property/amenity/amenitiesTag";

export async function checkAmenityTagIsInUseOrNot(tagId: mongoose.Types.ObjectId) {

    const check = await AmenitiesTag.aggregate([
        {
            $match: {
                _id: tagId
            }
        },
        {
            $lookup: {
                from: "amenities",
                localField: "_id",
                foreignField: "tag",
                as: "amenities"
            }
        },

        {
            $lookup: {
                from: "properties",
                localField: "amenities._id",
                foreignField: "amenities",
                pipeline: [
                    {
                        $limit: 1,
                    },
                    {
                        $project: {
                            amenities: 1
                        }
                    }
                ],
                as: "properties"
            }
        },
        {
            $addFields: {
                isInUse: { $gt: [{ $size: "$properties" }, 0] }
            }
        },
    ])

    return check[0]?.isInUse

}