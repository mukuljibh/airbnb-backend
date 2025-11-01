import { agenda } from "../../../../config/agenda";
import { userDefines } from "./defines/user.define";
import { Types } from "mongoose";


interface IUserDeletion {
    userId: Types.ObjectId,


}
export async function scheduleUserAccountDeletion(options: IUserDeletion) {

    const { userId } = options

    agenda.schedule('in 15 days', userDefines.AUTO_DELETE_ACCOUNT, { userId })
        .catch(() => console.log(`error scheduling ${userDefines.AUTO_DELETE_ACCOUNT} job`))


}