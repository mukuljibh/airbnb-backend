import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({

    // API version
    API_VERSION: z.enum(["v1", "v2"], {
        message: "API_VERSION must be either 'v1' or 'v2'",
    }),

    NODE_ENV: z.enum(["development", "production"], {
        message: "NODE_ENV is required and must be either 'development' or 'production'",
    }),

    // Ports
    LOCAL_PORT: z.string().transform(Number).refine(val => !isNaN(val) && val > 0, {
        message: "LOCAL_PORT must be a valid number greater than 0",
    }),
    PROD_PORT: z.string().transform(Number).refine(val => !isNaN(val) && val > 0, {
        message: "PROD_PORT must be a valid number greater than 0",
    }),

    // URLs
    HOST_URL: z.string().url("HOST_URL must be a valid URL"),
    GUEST_URL: z.string().url("GUEST_URL must be a valid URL"),

    TEST_MODE: z
        .enum(["0", "1"], {
            message: "TEST_MODE must be either '0' or '1'",
        })
        .default("0"),



    MOBILE_URL: z.string(),
    SERVER_URL: z.string().url({ message: "SERVER_URL must be a valid URL" }),

    // Mail
    MAIL_HOST: z.string().min(1, "MAIL_HOST is required"),
    MAIL_USER: z.string().email("MAIL_USER must be a valid email"),
    MAIL_FROM: z.string().min(1, "MAIL_FROM must be a valid email"),
    SENDGRID_API_KEY: z.string().min(1, "SENDGRID_API_KEY is required"),
    ENABLE_EMAIL: z
        .preprocess((val) => val === "1", z.boolean())
        .default(false),


    // Auth
    ACCESS_TOKEN_KEY: z.string().min(10, "ACCESS_TOKEN_KEY must be at least 10 characters long"),
    SESSION_SECRET: z.string().min(10, "SESSION_SECRET must be at least 10 characters long"),

    // Mongo
    MONGO_URL: z.string().url("MONGO_URL must be a valid MongoDB connection string"),

    // Google OAuth
    GOOGLE_CLIENT_ID: z.string().min(5, "GOOGLE_CLIENT_ID is required"),
    GOOGLE_CLIENT_SECRET: z.string().min(5, "GOOGLE_CLIENT_SECRET is required"),

    // Facebook OAuth
    FACEBOOK_APP_ID: z.string().min(5, "FACEBOOK_APP_ID is required"),
    FACEBOOK_APP_SECRET: z.string().min(5, "FACEBOOK_APP_SECRET is required"),

    // Stripe
    STRIPE_SECRET_KEY: z.string().startsWith("sk_").min(10, "STRIPE_SECRET_KEY is invalid"),
    STRIPE_PUBLIC_KEY: z.string().startsWith("pk_").min(10, "STRIPE_PUBLIC_KEY is invalid"),
    ENDPOINT_SECRET: z.string().min(5, "ENDPOINT_SECRET is required"),
    CONNECT_SECRET: z.string().min(5, "CONNECT_SECRET is required"),


    //Razorpay
    RAZORPAY_KEY_ID: z.string().min(10, "RAZORPAY_KEY_ID is required"),
    RAZORPAY_KEY_SECRET: z.string().min(10, "RAZORPAY_KEY_SECRET is required"),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(10, "RAZORPAY_WEBHOOK_SECRET is required"),

    // CSRF
    CSRF_ENCRYPTION_KEY: z.string().min(10, "CSRF_ENCRYPTION_KEY must be at least 10 characters long"),

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
    CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
    CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
    CLOUDINARY_URL: z.string().url("CLOUDINARY_URL must be a valid Cloudinary URL"),
    GOOGLE_MAPS_API_KEY: z.string().min(1, "GOOGLE_MAPS_API_KEY is required"),

    IS_USING_NGROK: z
        .preprocess((val) => val === "true", z.boolean())
        .default(false),


});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:\n");
    parsed.error.issues.forEach((issue) => {
        console.error(`• ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
}

const parsedData = parsed.data

const HOST_URL =
    parsedData.TEST_MODE === "1"
        ? "https://userpanel-test.netlify.app"
        : parsedData.HOST_URL;

const GUEST_URL =
    parsedData.TEST_MODE === "1"
        ? "https://main-website-test.netlify.app"
        : parsedData.GUEST_URL;

export default {
    ...parsedData,
    HOST_URL,
    GUEST_URL,
    GUEST_BASE_PATH: `/api/${parsedData.API_VERSION}/guest`,
    HOST_BASE_PATH: `/api/${parsedData.API_VERSION}/host`,
    ADMIN_BASE_PATH: `/api/${parsedData.API_VERSION}/admin`,
    PREFIX_VERSION_PATH: `/api/${parsedData.API_VERSION}`
};