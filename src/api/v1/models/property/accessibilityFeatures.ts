import mongoose from "mongoose";

const accessibilityFeaturesSchema = new mongoose.Schema({
    property_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true,
        unique: true
    },
    guest_entrance_and_parking: {
        step_free_access: { type: Boolean, default: false },
        disabled_parking_spot: { type: Boolean, default: false },
        guest_entrance_wider_than_32_inches: { type: Boolean, default: false }
    },
    bed_room: {
        step_free_bedroom_access: { type: Boolean, default: false },
        bed_room_entrance_wider_than_32_inches: { type: Boolean, default: false }
    },
    bath_room: {
        step_free_bathroom_access: { type: Boolean, default: false },
        bath_room_entrance_wider_than_32_inches: { type: Boolean, default: false },
        toilet_grab_bar: { type: Boolean, default: false },
        shower_grab_bar: { type: Boolean, default: false },
        step_free_shower: { type: Boolean, default: false },
        shower_or_bath_chair: { type: Boolean, default: false }
    },
    adaptive_equipment: {
        ceiling_or_mobile_hoist: { type: Boolean, default: false }
    }
})

const AccessibilityFeatures = mongoose.model('AccessibilityFeatures', accessibilityFeaturesSchema);

export { AccessibilityFeatures }
