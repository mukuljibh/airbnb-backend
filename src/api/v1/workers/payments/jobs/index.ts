import { agenda } from "../../../config/agenda";
import { paymentDefine } from "./defines/payment.define";



export async function schedulePaymentJob(task) {

    agenda.now(paymentDefine.PROCESS_PAYMENT, task)
        .then(async () => console.log('payment Job schedule successfully'))
        .catch((err) => console.log('error scheduling payment Job.', err))

}