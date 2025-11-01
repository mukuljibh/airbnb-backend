import mongoose from 'mongoose';
import { extractPublicId } from '../helpers/uploads.helper';


const uploadLogsSchema = new mongoose.Schema({

    publicId: {
        type: String,
    },
    url: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['temp'],
        default: 'temp',
    },
    uploadCreatedAt: {
        type: Date,
        default: Date.now
    }
});

uploadLogsSchema.pre('save', async function (next) {
    const publicId = this.publicId
    const url = this.url
    if (!publicId) {
        this.publicId = extractPublicId(url)
    }
    next()
})

uploadLogsSchema.index({ publicId: 1 })
const UploadLogs = mongoose.model('UploadLogs', uploadLogsSchema);

export default UploadLogs;
