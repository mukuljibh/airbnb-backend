import { ApiError } from "../../v1/utils/error-handlers/ApiError";

export type ContextType = "category" | "chat" | "property" | "profile" | "amenities" | "article"

export function getFolderAndTagNameBasedOnContext(context: ContextType, verifiedData) {

    let folderName

    const tags = []

    tags.push(context)

    switch (context) {
        case "chat": {
            const { roomId, userId } = verifiedData
            tags.push(`room_${roomId}`, `user_${userId}`);
            folderName = `/chat_attachments/room_${roomId}/user_${userId}`
            break
        }
        case "amenities": {
            tags.push('amenity_icon');
            folderName = `/amenity_icons`;
            break
        }
        case "category": {
            tags.push('category_image');
            folderName = `/category_images`;
            break;
        }
        case "profile": {
            const { userId } = verifiedData
            tags.push(`user_${userId}`, 'profile_image');
            folderName = `/profile_image/user_${userId}`
            break
        }
        case "property": {
            const { propertyId, userId } = verifiedData
            if (propertyId) {
                tags.push(`property_${propertyId}`)
            }

            tags.push(`user_${userId}`, 'property', 'property_images');
            folderName = `/property_images/user_${userId}/`
            break
        }
        case "article": {
            tags.push('article_image');
            folderName = `/article_images`;
            break;
        }
        default: {
            throw new ApiError(400, 'please provide context from one of "chat" | "profile" | "property" | "amenities" | "category" | "article" and make sure you are passing context environment  ids along with it. ')
        }
    }
    return {
        tags: tags,
        folderName
    }
}

export function extractPublicId(url) {

    // const regex = /\/image\/upload\/v[0-9]+\/(.*)\.[a-z]{3,4}$/;
    const regex = /\/(?:image|raw)\/upload\/v[0-9]+\/(.+)\.[a-z0-9]+$/i;

    const match = url.match(regex);

    if (match) {
        const publicId = match[1]; // This will give you the public_id without extension
        return publicId
    } else {
        console.log('No match found!');
    }

}



