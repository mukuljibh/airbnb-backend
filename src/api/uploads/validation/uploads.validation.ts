import { body } from 'express-validator';
import mongoose from 'mongoose';

export const filePayloadValidator = [

    body('context')
        .exists()
        .isIn(['chat', 'profile', 'property', 'amenities', 'category', 'article'])
        .withMessage('please provide context from one of "chat" | "profile" | "property" | "category" | "amenities" | "article" and make sure you are passing context environment  ids along with it.'),

    body('roomId')
        .if((value, { req }) => req.body.context === 'chat')
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage('roomId must be a valid MongoDB ObjectId'),


    body('userId')
        .if((value, { req }) => req.body.context === 'chat' || req.body.context === "property" || req.body.context === "profile")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage('userId must be a valid MongoDB ObjectId'),



    body('propertyId')
        .optional()
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage('propertyId is optional if provided must be a valid MongoDB ObjectId.'),

];
