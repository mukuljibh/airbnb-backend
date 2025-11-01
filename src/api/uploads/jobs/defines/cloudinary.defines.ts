import moment from "moment";
import { agenda } from "../../../v1/config/agenda"
import UploadLogs from "../../models/uploadLogs";
import { cloudinary } from "../../cloudinary";

export const uploadDefines = {
    CLEANUP_RESOURCE: 'cleanup_resource'

}



agenda.define(uploadDefines.CLEANUP_RESOURCE, { lockLifetime: 60000 }, async () => {

    const varMinutesAgo = moment().subtract(30, 'minutes').toDate();

    const oldUploads = await UploadLogs.find({
        uploadCreatedAt: { $lt: varMinutesAgo }
    })
        .select('publicId')
        .lean();

    const publicIds = oldUploads.map(x => x.publicId);

    if (publicIds.length > 0) {
        const deleteFromDB = UploadLogs.deleteMany({ publicId: { $in: publicIds } });
        const deleteFromCloudinary = cloudinary.api.delete_resources(publicIds);

        const result = await Promise.all([deleteFromDB, deleteFromCloudinary]);
        console.log('Deleted:', result);
    } else {
        console.log('No old uploads found');
    }

})

