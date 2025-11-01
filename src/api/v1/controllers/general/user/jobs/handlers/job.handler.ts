import { User } from "../../../../../models/user/user";
import { USER_STATUS } from "../../../../../models/user/enums/user.enum";
import { withMongoTransaction } from "../../../../../utils/mongo-helper/mongo.utils";
import { changeUserState } from "../../../../common/user/services/account.service";
import { changePropertyState } from "../../../../common/property/property.service";




export async function deleteAccountRequest(job) {
    const { userId } = job.attrs.data;

    const targetUser = await User.findById(userId).select('-password');

    if (!targetUser) {
        console.warn(`Auto-delete job aborted: No user found with ID ${userId}`);
        return;
    }

    if (targetUser.status !== USER_STATUS.PENDING_DELETION) {
        console.warn(`Auto-delete job aborted: User ${userId} status is not '${USER_STATUS.PENDING_DELETION}', current status: '${targetUser.status}'`);
        return;
    }

    // const newStatus = USER_STATUS.DELETED;
    // const reason = 'User requested deactivation; 15 days elapsed - system auto deleted the account';

    await withMongoTransaction(async (session) => {
        await changeUserState({
            userId: userId,
            userNewStatus: "deleted",
            reason: "User requested account deletion; system confirmed successful removal.",
            role: "system",
            session,
        })
        await changePropertyState({
            userId: userId,
            newPropertyStatus: "deleted",
            reason: "System-generated entry: user-initiated account and associated property data deleted successfully.",
            role: "system",
            session,
        })
    })


}


