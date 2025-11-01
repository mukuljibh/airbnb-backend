import { body, validationResult } from "express-validator";
import mongoose from "mongoose";

export const helpTopicValidator = [
    body("parentId")
        .optional({ checkFalsy: true })
        .custom((value) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error("Invalid parentId");
            }
            return true;
        }),

    body("articleId")
        .optional({ checkFalsy: true })
        .custom((value) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error("Invalid articleId");
            }
            return true;
        }),

    body("audience")
        .optional()
        .customSanitizer((value) => {
            if (typeof value === "string") {
                return [value];
            }
            return value;
        })
        .isArray({ min: 1 })
        .withMessage("audience must be a non-empty array")
        .custom((arr) => {
            for (const id of arr) {
                if (!mongoose.Types.ObjectId.isValid(id)) {
                    throw new Error("Invalid audience ID");
                }
            }
            return true;
        }),


    body("title")
        .trim()
        .notEmpty()
        .withMessage("title is required")
        .isLength({ max: 200 })
        .withMessage("title must be under 200 characters"),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("description must be under 1000 characters"),

    body("slug")
        .optional()
        .trim()
        .isSlug()
        .withMessage("slug must be URL-friendly"),

    body("tags")
        .optional()
        .isArray()
        .withMessage("tags must be an array of strings")
        .custom((arr) => {
            if (!arr.every((t: any) => typeof t === "string")) {
                throw new Error("tags must be an array of strings");
            }
            return true;
        }),

    body("order")
        .optional()
        .isInt({ min: 0 })
        .withMessage("order must be a positive integer"),

    body("type")
        .isIn(["topic", "subcategory", "innertopic", "article"])
        .withMessage("Invalid type"),

    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be boolean"),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];


export const helpArticleValidator = [
    body("topicId")
        .notEmpty()
        .withMessage("topicId is required")
        .custom((value) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error("Invalid topicId");
            }
            return true;
        }),

    body("image")
        .optional()
        .isURL()
        .withMessage("image must be a valid URL"),

    body("title")
        .trim()
        .notEmpty()
        .withMessage("title is required")
        .isLength({ max: 200 })
        .withMessage("title must be under 200 characters"),

    body("slug")
        .optional()
        .trim()
        .isSlug()
        .withMessage("slug must be URL-friendly"),

    body("content")
        .trim()
        .notEmpty()
        .withMessage("content is required"),

    body("summary")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("summary must be under 500 characters"),

    body("type")
        .optional()
        .isString()
        .withMessage("type must be a string"),

    // body("audience")
    //     .notEmpty()
    //     .withMessage("audience is required")
    //     .custom((value) => {
    //         if (!mongoose.Types.ObjectId.isValid(value)) {
    //             throw new Error("Invalid audience ID");
    //         }
    //         return true;
    //     }),

    body("status")
        .optional()
        .isIn(["draft", "published"])
        .withMessage("status must be either draft or published"),

    body("views")
        .optional()
        .isInt({ min: 0 })
        .withMessage("views must be a non-negative integer"),

    body("tags")
        .optional()
        .isArray()
        .withMessage("tags must be an array of strings")
        .custom((arr) => {
            if (!arr.every((t: any) => typeof t === "string")) {
                throw new Error("tags must be an array of strings");
            }
            return true;
        }),

    body("metaTitle")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("metaTitle must be under 200 characters"),

    body("metaDescription")
        .optional()
        .trim()
        .isLength({ max: 300 })
        .withMessage("metaDescription must be under 300 characters"),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];


export const helpTabValidator = [
    body("tabName")
        .trim()
        .toLowerCase()
        .notEmpty()
        .withMessage("tabName is required")
        .isLength({ max: 100 })
        .withMessage("tabName must be under 100 characters"),

    body("isVisible")
        .optional()
        .isBoolean()
        .withMessage("isVisible must be boolean"),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];