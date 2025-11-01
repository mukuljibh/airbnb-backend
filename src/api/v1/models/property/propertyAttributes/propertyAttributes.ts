
export const propertyLocationObject =
{
    regionId: String,
    address: String,
    city: String,
    zipCode: String,
    country: String,
    state: String,
    landmark: String,
    coordinates: {
        latitude: Number,
        longitude: Number,
    },
    locationGeo: {
        type: {
            type: String,
            default: "Point",
        },
        coordinates: {
            type: [Number],
            // index: "2dsphere"
        }
    }

}

export const propertyVerficationDocumentObject =
{
    publicId: String,
    documentType: {
        type: String,
        required: true,
        enum: [
            'government-issued ID',
            'rental agreement',
            'land registry document',
            'electricity bill',
            'water bill',
            'property tax receipt',
            'property deed',
            'gas bill',
            'No Objection Certificate',
        ],
    },
    documentUrl: {
        type: String,
        required: true,
    },
}

export const VERIFICATION_STATUS = {
    OPEN: 'open',
    PENDING: 'pending',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
    REQUIRED_ACTION: 'required_action'
} as const

export const PROPERTY_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DELETED: 'deleted',
    SUSPENDED: 'suspended',
    PENDING_DELETION: 'pending_deletion',

} as const


export const propertyVerificationObject = {
    status: {
        type: String,
        enum: Object.values(VERIFICATION_STATUS),
        default: VERIFICATION_STATUS.OPEN,
    },

    lastStatus: String,

    reason: {
        type: String,
        trim: true,
    },

    documents: [propertyVerficationDocumentObject]
}