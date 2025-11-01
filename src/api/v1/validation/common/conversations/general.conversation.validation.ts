import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';



const requireFieldForGuest = (field, validatorFn, message) => {
    return body(field)
        .custom((value, { req }) => {
            const role = req.res?.locals?.sessionOptions?.role;
            const receiverPanel = req.body.receiverPanel;

            if (role === 'guest' && (value === undefined || value === null || value === '') && receiverPanel != 'admin') {
                throw new Error(`${field.split('.').pop()} is required for guest`);
            }
            return true;
        })
        .bail()
        .custom((value, { req }) => {
            // Skip validation if value is not present
            if (value === undefined || value === null || value === '') return true;
            return validatorFn(value, { req });
        })
        .withMessage(message);
};

export const validateIntiateConversation = [

    requireFieldForGuest(
        'propertyId',
        (value, { req }) => {
            const role = req.res?.locals?.sessionOptions?.role;
            if (role === 'guest' && !value) {
                throw new Error('propertyId is required for guests-host conversation');
            }
            if (value && !mongoose.Types.ObjectId.isValid(value)) {
                throw new Error('Invalid propertyId');
            }
            return true
        },
        'propertyId is required for guests-host conversations'
    ),


    body('receiverId')
        .customSanitizer((value, { req }) => {
            if ((!value || value === '') && req.body.receiverPanel === 'admin') {
                return '67ca938ba2116899a6cb24c2'; // temp logic will change in version 2
            }
            return value;
        })
        .custom((value) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error('Invalid receiverId');
            }
            return true;
        })
    ,

    body('message')
        .notEmpty().withMessage('Message is mandatory')
        .isString().withMessage('Message must be a string'),

    body('receiverPanel')
        .isIn(['host', 'admin'])
        .withMessage('receiverPanel must be either host or admin'),

    // Conditionally required queryDetails
    body('queryDetails')
        .custom((value, { req }) => {
            const currentPanel = req.res?.locals?.sessionOptions?.role;
            const receiverPanel = req.body.receiverPanel;
            if (currentPanel === 'guest' && !value && receiverPanel != 'admin') {
                throw new Error('queryDetails is required for guests');
            }
            if (value && typeof value !== 'object') {
                throw new Error('queryDetails must be an object');
            }
            return true;
        }),

    requireFieldForGuest(
        'queryDetails.checkIn',
        (value) => !isNaN(Date.parse(value)),
        'CheckIn must be a valid ISO date'
    ),

    requireFieldForGuest(
        'queryDetails.checkOut',
        (value, { req }) => {
            const checkIn = req.body.queryDetails?.checkIn;
            if (!isNaN(Date.parse(value)) && (!checkIn || new Date(value) > new Date(checkIn))) {
                return true;
            }
            throw new Error('CheckOut must be a valid ISO date and after CheckIn');
        },
        'CheckOut must be a valid date after CheckIn'
    ),

    requireFieldForGuest(
        'queryDetails.adults',
        (value) => Number.isInteger(value) && value >= 1,
        'There must be at least one adult'
    ),

    requireFieldForGuest(
        'queryDetails.children',
        (value) => Number.isInteger(value) && value >= 0,
        'Children must be a non-negative integer'
    ),
    requireFieldForGuest(
        'queryDetails.currency',
        (value) => typeof value === 'string' && value.trim().length > 0,
        'Currency is required and must be a non-empty string'
    ),


    // Final error handler
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];


export const validateUpdateConversation = [

    // requireFieldForGuest(
    //     'propertyId',
    //     (value, { req }) => {
    //         const role = req.res?.locals?.sessionOptions?.role;
    //         if (role === 'guest' && !value) {
    //             throw new Error('propertyId is required for guests-host conversation');
    //         }
    //         if (value && !mongoose.Types.ObjectId.isValid(value)) {
    //             throw new Error('Invalid propertyId');
    //         }
    //         return true
    //     },
    //     'propertyId is required for guests-host conversations'
    // ),
    body('propertyId')
        .optional()
        .custom((value) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error('Invalid propertyId');
            }
            return true;
        }),


    body('message')
        .notEmpty().withMessage('Message is mandatory')
        .isString().withMessage('Message must be a string'),

    // Conditionally required queryDetails
    body('queryDetails')
        .custom((value, { req }) => {
            const currentPanel = req.res?.locals?.sessionOptions?.role;
            const receiverPanel = req.body.receiverPanel;
            if (currentPanel === 'guest' && !value && receiverPanel != 'admin') {
                throw new Error('queryDetails is required for guests');
            }
            if (value && typeof value !== 'object') {
                throw new Error('queryDetails must be an object');
            }
            return true;
        }),

    requireFieldForGuest(
        'queryDetails.checkIn',
        (value) => !isNaN(Date.parse(value)),
        'CheckIn must be a valid ISO date'
    ),

    requireFieldForGuest(
        'queryDetails.checkOut',
        (value, { req }) => {
            const checkIn = req.body.queryDetails?.checkIn;
            if (!isNaN(Date.parse(value)) && (!checkIn || new Date(value) > new Date(checkIn))) {
                return true;
            }
            throw new Error('CheckOut must be a valid ISO date and after CheckIn');
        },
        'CheckOut must be a valid date after CheckIn'
    ),

    requireFieldForGuest(
        'queryDetails.adults',
        (value) => Number.isInteger(value) && value >= 1,
        'There must be at least one adult'
    ),

    requireFieldForGuest(
        'queryDetails.children',
        (value) => Number.isInteger(value) && value >= 0,
        'Children must be a non-negative integer'
    ),
    requireFieldForGuest(
        'queryDetails.currency',
        (value) => typeof value === 'string' && value.trim().length > 0,
        'Currency is required and must be a non-empty string'
    ),


    // Final error handler
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];
