// import Stripe from 'stripe';
// import { IUser } from '../../models/user/types/user.model.types';
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// export async function createStripeCustomer(email: string, user: IUser) {
//    if (user.stripe_customer_id) {
//       return { stripeCustomerId: user.stripe_customer_id };
//    }
//    // Create a new Stripe Customer
//    const customer = await stripe.customers.create({ email });
//    // Save the Stripe Customer ID to the database
//    user.stripe_customer_id = customer.id;
//    return { stripeCustomerId: customer.id };
// }

// export const saveUserCard = async (paymentMethodId: string, user: IUser) => {
//    // Attach the card to the customer
//    await stripe.paymentMethods.attach(paymentMethodId, {
//       customer: user.stripe_customer_id,
//    });

//    // Set it as the default payment method
//    await stripe.customers.update(user.stripe_customer_id, {
//       invoice_settings: { default_payment_method: paymentMethodId },
//    });

//    // Store in DB (optional)
//    user.default_payment_method = paymentMethodId;
//    return true;
// };

// export const getUserSavedCards = async (
//    paymentMethodId: string,
//    user: IUser,
// ) => {
//    const savedCards = await stripe.paymentMethods.list({
//       customer: user.stripe_customer_id,
//       type: 'card',
//    });
//    return savedCards;
// };
