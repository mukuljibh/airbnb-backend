
import { stripe } from "../../../../../config/stripe";
import { GatewayOptions, StripePaymentMethod } from "./gateway";

interface ISessionService {
    method: StripePaymentMethod;
    options: GatewayOptions
}
export function createStripeReservationService(params: ISessionService) {


    const { method, options } = params
    const { line_items, metadata } = options

    const { successUrl, cancelUrl, ...restMetadata } = metadata

    async function createPaymentSession() {
        let sessionPayload;
        switch (method) {
            case 'payment_link': {
                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    mode: 'payment',
                    line_items: line_items,
                    shipping_address_collection: undefined,
                    billing_address_collection: 'required',
                    expires_at: Math.floor(Date.now() / 1000) + 1860,
                    success_url: successUrl,
                    cancel_url: cancelUrl,
                    payment_intent_data: {
                        metadata: restMetadata,
                    },
                    invoice_creation: {
                        enabled: true,
                    },
                });
                sessionPayload = session
                break
            }
            default: {
                throw new Error(`Unsupported payment method: ${method}`);
            }
        }

        return {
            sessionId: sessionPayload.id,
            url: sessionPayload.url,
        }

    }

    return { createPaymentSession }
}