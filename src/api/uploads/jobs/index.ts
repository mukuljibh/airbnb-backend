import { agenda } from "../../v1/config/agenda";
import { uploadDefines } from "./defines/cloudinary.defines";

export async function scheduleCleanupResource() {
    try {
        const existingJobs = await agenda.jobs({ name: uploadDefines.CLEANUP_RESOURCE });

        if (existingJobs.length === 0) {
            await agenda.every('1 hour', uploadDefines.CLEANUP_RESOURCE);
            console.log('Cleanup resource job scheduled.');
        } else {
            console.log('Cleanup resource job already exists. Skipping scheduling.');
        }
    }
    catch (err) {
        console.log("error starting Cloudinary cleanup", err)
    }
}