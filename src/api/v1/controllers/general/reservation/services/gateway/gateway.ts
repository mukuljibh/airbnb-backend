import { createRazorpayReservationService } from './razorpay.gatway';
import { createStripeReservationService } from './stripe.gateway';

interface ILineItem {
    price_data: {
        currency: string;
        product_data: {
            name: string;
            description: string;
            images?: string[];
        };
        unit_amount: number;
    };
    quantity: number;
}

interface IReservationMetadata {
    server_url: string;
    userId: string;
    reservationId: string;
    transactionId: string;
    hostId: string;
    hasInstantBooking: any;
    guestName: string;
    checkInDate: string;
    checkOutDate: string;
    guestCount: number;
    guestEmail: string;
    propertyTitle: string;
    reservationCode: string;
    propertyAddress: string;
    propertyThumbnail: string;
    nights: number;
    promoCodeId: string;
    successUrl: string;
    cancelUrl: string;
}

type Gateway = 'stripe' | 'razorpay'

export type StripePaymentMethod = 'payment_link';
export type RazorpayPaymentMethod = 'payment_link' | 'invoice_payment_link';


type GatewayMethod<T extends Gateway> =
    T extends 'stripe' ? StripePaymentMethod :
    T extends 'razorpay' ? RazorpayPaymentMethod
    : never;

export type GatewayOptions = {
    line_items: ILineItem[];
    metadata: IReservationMetadata
}

export async function createReservationGatewayService<T extends Gateway>
    (gateway: T, method: GatewayMethod<T>, options: GatewayOptions) {

    switch (gateway) {
        case "stripe": {
            const stripeService = createStripeReservationService({
                method: method as StripePaymentMethod,
                options
            });
            const result = await stripeService.createPaymentSession();
            return result;
        }

        case 'razorpay': {
            const razorpayService = createRazorpayReservationService({
                method: method as RazorpayPaymentMethod,
                options
            });
            const result = await razorpayService.createPaymentSession();
            return result;
        }

        default: {
            throw new Error(`Unsupported gateway: ${gateway}`);
        }
    }
}

