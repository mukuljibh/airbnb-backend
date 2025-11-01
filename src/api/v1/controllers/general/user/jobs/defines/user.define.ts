import { agenda } from "../../../../../config/agenda";
import { deleteAccountRequest } from "../handlers/job.handler";



export const userDefines = {
    AUTO_DELETE_ACCOUNT: 'auto_delete_account',
}


agenda.define(userDefines.AUTO_DELETE_ACCOUNT, deleteAccountRequest);



