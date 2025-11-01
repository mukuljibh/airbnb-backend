import mongoose from "mongoose";
// Not in use currently

const payoutSchema = new mongoose.Schema({

    hostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    //  References for searching faster
    reservationIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reservation',
        required: true
    }],

    // Per-Reservation Breakdown
    reservations: [{

        _id: false,

        reservationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Reservation',
            required: true
        },

        originalAmount: {

            gross: { type: Number, required: true }, // Base + hotel fees - discounts(offered by hotel)

            tax: { type: Number, default: 0 }, // 18 percent of gross

            hostPlatformFee: { type: Number, required: true },   // 3% of gross

            currency: { type: String, required: true, uppercase: true }

        },
        // All converted values are in payoutAmount.currency

        conversion: {

            rate: { type: Number, required: true },

            convertedGross: { type: Number, required: true },

            convertedTax: { type: Number, default: 0 },

            convertedHostPlatformFee: { type: Number, required: true },

            timestamp: { type: Date, default: Date.now }

        }
    }],

    // Final Host Payout Summary convertedGross + convertedTax - convertedHostPlatFormFee
    payoutAmount: {

        amount: { type: Number, required: true }, // Total of all convertedGross - convertedHostFee + tax

        currency: { type: String, required: true, uppercase: true }

    },

    status: {
        type: String,
        enum: ['open', 'processing', 'paid', 'failed'],
        default: 'open'
    },

    payoutDate: { type: Date },

    method: {
        type: String,
        enum: ['manual', 'stripe', 'bank_transfer'],
        default: 'manual'
    },

    notes: { type: String }

}, { timestamps: true });

const Payout = mongoose.model('Payout', payoutSchema);

export default Payout;
