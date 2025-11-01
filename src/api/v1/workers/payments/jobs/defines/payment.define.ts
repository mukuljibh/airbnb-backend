import { agenda } from "../../../../config/agenda";
import { paymentProcessor } from "../../payment.processor";


export const paymentDefine = {
    PROCESS_PAYMENT: 'process-payment',

}



agenda.define(
    paymentDefine.PROCESS_PAYMENT,
    {
        concurrency: 1,
        lockLimit: 1,
        lockLifetime: 60000
    },
    async (job) => {
        const task = job.attrs.data;
        console.log(`Processing payment job:${task?.id}`);

        await paymentProcessor(task);

        await job.remove();

    }
);
