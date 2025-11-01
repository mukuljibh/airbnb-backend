import { ClientSession } from "mongoose";
import { extractPublicId } from "../helpers/uploads.helper";
import UploadLogs from "../models/uploadLogs";


interface IPayload {
    publicId: string;
    url?: string,
    documentUrl?: string
}
interface IOptions {
    existingFiles: IPayload[],
    incomingFiles: IPayload[],
    session?: ClientSession
}

export async function syncAndDeleteFiles(
    options: IOptions
) {
    const { existingFiles, incomingFiles, session } = options
    const existingPublicIds = new Set(existingFiles.map(f => f.publicId));

    const normalizedIncoming = incomingFiles.map(file => {
        const url = file.url || file.documentUrl;
        const publicId = file.publicId || extractPublicId(url);
        return { ...file, publicId };
    });

    const incomingPublicIds = new Set(normalizedIncoming.map(f => f.publicId));

    const filesToDelete = existingFiles.filter(
        f => !incomingPublicIds.has(f.publicId)
    );

    const newFilePublicIds = [...incomingPublicIds].filter(
        id => !existingPublicIds.has(id)
    );

    const tasks: Promise<any>[] = [];

    if (filesToDelete.length > 0) {
        const logs = filesToDelete.map(file => ({
            url: file.url || file.documentUrl,
            publicId: file.publicId,
        }));
        tasks.push(UploadLogs.insertMany(logs, { session }));
    }

    if (newFilePublicIds.length > 0) {
        tasks.push(
            UploadLogs.deleteMany({ publicId: { $in: newFilePublicIds } }).session(
                session
            )
        );
    }

    await Promise.all(tasks);

    return normalizedIncoming;
}


export function releaseUploadResources(url) {

    const publicId = extractPublicId(url)

    if (!url && !publicId) {
        return
    }

    UploadLogs.create({ url })
        .then(() => {
            console.log(`[PROC] Public id removed (stored in upload log): ${publicId}`)
        })
        .catch(err => {
            console.error("error deleting upload log", err);
        });

}

export function confirmUploadResources(url) {

    const publicId = extractPublicId(url)

    if (!url && !publicId) {
        return
    }

    UploadLogs.deleteOne({ publicId })
        .then(() => {
            console.log(`[PROC] Public id stored (remove from upload log): ${publicId}`)
        })
        .catch(err => {
            console.error("error deleting upload log", err);
        });

}
