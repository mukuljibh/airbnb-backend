import { ClientSession } from "mongoose"
import { agenda } from "../../../../config/agenda"
import { User } from "../../../../models/user/user"
import { MongoObjectId } from "../../../../types/mongo/mongo"
import { withMongoTransaction } from "../../../../utils/mongo-helper/mongo.utils"
import { userDefines } from "../../../general/user/jobs/defines/user.define"
import { UserStatus } from "../../../../models/user/types/user.model.types"
import moment from "moment"
import { USER_STATUS } from "../../../../models/user/enums/user.enum"
import { ApiError } from "../../../../utils/error-handlers/ApiError"
import { changePropertyState } from "../../property/property.service"



interface IOpenAccount {
    status?: 'pending_deletion',
    userId: MongoObjectId

}

export async function reopenUserAccountBySystem(options: IOpenAccount) {
    const { userId } = options

    const user = await User.findById(userId)

    await withMongoTransaction(async (session) => {

        const userChangeState = changeUserState({ userId: user._id, userNewStatus: "release_deletion", reason: "release deletion by system", role: "system", session })
        const propertyChangeState = changePropertyState({ userId: user._id, newPropertyStatus: "release_deletion", reason: "release deletion by system", role: "system", session })
        await Promise.all([userChangeState, propertyChangeState])

    })

    agenda.cancel({
        name: userDefines.AUTO_DELETE_ACCOUNT,
        'data.userId': userId
    }).catch(() => console.log(`error cancelling us ${userDefines.AUTO_DELETE_ACCOUNT} job`))


}



interface BaseChangeOptions {
    userId: MongoObjectId;
    reason?: string;
    role?: 'system' | 'admin' | 'user';
    session?: ClientSession;
}

interface UserStatusChangeOptions extends BaseChangeOptions {
    userNewStatus?: UserStatus | 'unsuspended' | 'release_deletion';
}

export async function changeUserState(options: UserStatusChangeOptions) {
    const { userId, role = 'system', reason, userNewStatus: requestedStatus, session } = options;

    const now = moment.utc().startOf('day').toDate();

    const user = await User.findOne({ _id: userId, status: { $ne: USER_STATUS.PENDING } });
    if (!user) {
        throw new ApiError(404, 'User not found or in pending status');
    }

    if (user.status === requestedStatus) {
        throw new ApiError(409, `The user account is already ${requestedStatus}.`);
    }

    const currentStatus = user.status;
    const lastMeta = user.statusMeta.at(-1);

    let finalStatus: UserStatus | undefined = requestedStatus as UserStatus;
    const userSetFields: Record<string, any> = {}
    switch (requestedStatus) {
        case 'release_deletion':
            if (!lastMeta || currentStatus !== 'pending_deletion') {
                throw new ApiError(409, 'User must be pending_deletion to release deletion');
            }
            finalStatus = lastMeta.previousStatus;
            userSetFields.deletionRequestedAt = null
            break;

        case 'unsuspended':
            if (!lastMeta || currentStatus !== 'suspended') {
                throw new ApiError(409, 'User must be suspended before unsuspending');
            }
            finalStatus = lastMeta.previousStatus;

            break;

        default:
            finalStatus = requestedStatus as UserStatus;
    }

    userSetFields.status = finalStatus

    const userMetaEntry = {
        previousStatus: currentStatus,
        newStatus: finalStatus,
        changedBy: { userId: ['system', 'admin'].includes(role) ? null : userId, role },
        timestamp: now,
        reason: reason || 'System generated: user logged in, account activated again.',
    };


    if (requestedStatus === USER_STATUS.PENDING_DELETION) {
        userSetFields.deletionRequestedAt = now
    }
    if (finalStatus == USER_STATUS.DELETED) {
        userSetFields.deletedAt = now
    }

    await User.updateOne(
        { _id: userId },
        {
            $set: userSetFields,
            $push: { statusMeta: { $each: [userMetaEntry], $slice: -10 } },
        },
        {
            session
        }
    );


}