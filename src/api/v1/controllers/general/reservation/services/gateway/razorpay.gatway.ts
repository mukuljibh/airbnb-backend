
import { razorpay } from "../../../../../config/razorpay";
import { GatewayOptions, RazorpayPaymentMethod } from "./gateway";


interface ISessionService {
    method: RazorpayPaymentMethod;
    options: GatewayOptions
}
export function createRazorpayReservationService(params: ISessionService) {


    const { method, options } = params
    const { line_items, metadata } = options

    const totalAmount = line_items.reduce((acc, item) => acc + item.price_data.unit_amount, 0);

    const trimmedMeta = {
        reservationId: metadata.reservationId,
        transactionId: metadata.transactionId,

        hasInstantBooking: metadata.hasInstantBooking
    }
    async function createPaymentSession() {

        let sessionPayload;
        switch (method) {

            case 'invoice_payment_link': {
                const price_data = line_items.map((item) => {
                    const productInfo = item.price_data.product_data

                    return {
                        name: productInfo.name,
                        description: productInfo.description,
                        amount: item.price_data.unit_amount,
                        quantity: 1,
                        currency: 'INR'
                    }
                })

                const customerId = 'cust_RKuJwoK83lAuXx'

                const invoice = await razorpay.invoices.create({
                    type: "invoice",
                    customer_id: customerId,
                    // draft: '1',
                    line_items: price_data,

                    notes: trimmedMeta,

                    // sms_notify: 1,
                    // email_notify: 1, 
                });
                sessionPayload = {
                    id: invoice.id,
                    url: invoice.short_url
                }

                break
            }
            case "payment_link": {
                const paymentLink = await razorpay.paymentLink.create({
                    amount: totalAmount,
                    currency: "INR",
                    customer: {
                        name: "test"
                    },
                    notify: { sms: true, email: true },
                    notes: trimmedMeta,
                    callback_url: metadata.successUrl,
                    callback_method: "get",
                });
                sessionPayload = {
                    id: paymentLink.id,
                    url: paymentLink.short_url
                }

            }
        }

        return {
            sessionId: sessionPayload.id,
            url: sessionPayload.url,
        }

    }

    return { createPaymentSession }
}