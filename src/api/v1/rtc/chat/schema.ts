import { body } from 'express-validator';

export const messagePayloadValidator = [

    body('message')
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage('message must be string'),

    body('messageType')
        .optional()
        .isIn(['plain', 'attachment'])
        .withMessage('messageType must be either "plain" or "attachment"'),

    body('url')
        .if((value, { req }) => req.body.messageType === 'attachment')
        .exists().withMessage('url is mandatory when messageType is attachment')
        .bail()
        .notEmpty().withMessage('url cannot be empty when messageType is attachment')
        .bail()
        .isURL().withMessage('url must be a valid URL'),

    body('url')
        .if((url, { req }) => {
            return url && (!req.body.messageType || req.body.messageType !== 'attachment')

        })
        .custom(() => {
            throw new Error('url is not allowed unless messageType is "attachment"');
        }),

    body('documentType')
        .if((value, { req }) => req.body.messageType === 'attachment')
        .exists().withMessage('documentType is mandatory when messageType is attachment')
        .isString()
        .withMessage('documentType must be string'),

];