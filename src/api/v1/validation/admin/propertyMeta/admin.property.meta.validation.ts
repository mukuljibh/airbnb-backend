import { body, validationResult } from 'express-validator';
import moment from 'moment';
export const validateAddAmenities = [
   body('title').trim().notEmpty().withMessage('title is mandatory'),
   body('amenities')
      .isArray({ min: 1 })
      .withMessage('amenities must be a non-empty array')
      .custom((value) => {
         return value.every(
            (amenity) =>
               typeof amenity.title === 'string' &&
               amenity.title.trim() !== '' &&
               typeof amenity.icon === 'string' &&
               amenity.icon.trim() !== '',
         );
      })
      .withMessage('Each amenity must have a non-empty title and icon'),

   body('description')
      .trim()
      .notEmpty()
      .withMessage('description is mandatory'),
   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         console.log(req.body);
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];

export const validatePromoCodePost = [
   body('promoCode')
      .exists()
      .withMessage('Promo code is required')
      .isString()
      .withMessage('Promo code must be a string')
      .trim()
      .notEmpty()
      .withMessage('Promo code cannot be empty'),

   body('discountType')
      .exists()
      .withMessage('Discount type is required')
      .isIn(['percentage', 'flat'])
      .withMessage("Discount type must be either 'percentage' or 'flat'"),

   body('discountValue')
      .exists()
      .withMessage('Discount value is required')
      .isFloat({ gt: 0 })
      .withMessage('Discount value must be a positive number')
      .custom((value, { req }) => {
         if (
            req.body.discountType === 'flat' &&
            parseFloat(value) > parseFloat(req.body.minimumSpend)
         ) {
            throw new Error(
               'Flat discount cannot be greater than minimum spend',
            );
         }
         return true;
      }),
   body('maximumDiscount')
      .if((value, { req }) => req.body.discountType === 'percentage')
      .exists()
      .withMessage('Maximum discount is required when discount type is percentage')
      .isFloat({ gt: 0 })
      .withMessage('Maximum discount must be a positive number'),


   body('validFrom')
      .exists()
      .withMessage('Valid from date is required')
      .isISO8601()
      .withMessage('Valid from date must be in ISO format'),

   body('validUntil')
      .exists()
      .withMessage('Valid until date is required')
      .isISO8601()
      .withMessage('Valid until date must be in ISO format')
      .custom((value, { req }) => {
         if (new Date(value) <= new Date(req.body.validFrom)) {
            throw new Error('Valid until date must be after valid from date');
         }
         return true;
      }),

   body('minimumSpend')
      .exists()
      .withMessage('Minimum spend is required')
      .isFloat({ min: 0 })
      .withMessage('Minimum spend must be a non-negative number'),

   body('eligibleUserTypes')
      .isIn(['newUser', 'existingUser'])
      .withMessage("Eligible user type must be either 'newUser' or 'existingUser'"),

   body('maxRedemptions')
      .optional()
      .default(1)
      .isInt({ min: 1 })
      .withMessage('Max redemptions must be at least 1'),

   body('maximumDiscount')
      .optional()
      // .exists()
      // .withMessage("maximumDiscount is required")
      .isInt()
      .withMessage('maximumDiscount must be a number'),

   body('maxPerUser')
      .optional()
      .default(1)
      .isInt({ min: 1 })
      .withMessage('maxPerUser must be at least 1'),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         console.log(req.body);
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];

export const validatePromoCodePatch = [
   body('promoCode')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('promCode code is required'),

   body('discountType')
      .isIn(['percentage', 'flat'])
      .withMessage("Discount type must be either 'percentage' or 'flat'"),

   body('discountValue')
      .isFloat({ gt: 0 })
      .withMessage('Discount value must be a positive number'),
   body('validFrom')
      .isISO8601()
      .withMessage('Valid from date must be in ISO format')
      .custom((value) => {
         const today = moment().startOf('day');
         const inputDate = moment(value).startOf('day');

         if (!inputDate.isValid()) {
            throw new Error('Invalid date');
         }

         if (inputDate.isBefore(today)) {
            throw new Error('Valid from date must be today or a future date');
         }

         return true;
      }),
   body('validUntil')
      .isISO8601()
      .withMessage('Valid until date must be in ISO format')
      .custom((value, { req }) => {
         const from = moment(req.body.validFrom).startOf('day');
         const until = moment(value).startOf('day');

         if (!from.isValid() || !until.isValid()) {
            throw new Error('Invalid date format');
         }

         if (!until.isAfter(from)) {
            throw new Error('Valid until date must be after valid from date');
         }
         return true;
      }),

   body('minimumSpend')
      .isFloat({ min: 0 })
      .withMessage('Minimum spend must be a non-negative number'),

   body('eligibleUserTypes')
      .isArray()
      .withMessage('Eligible user types must be an array'),

   body('maxRedemptions')
      .optional()
      .default(1)
      .isInt({ min: 1 })
      .withMessage('Max redemptions must be at least 1'),
   body('maxPerUser')
      .optional()
      .default(1)
      .isInt({ min: 1 })
      .withMessage('maxPerUser must be at least 1'),
   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         console.log(req.body);
         return res.status(400).json({ errors: errors.array() });
      }
      const allowedFields = [
         'promoCode',
         'description',
         'discountType',
         'discountValue',
         'validFrom',
         'validUntil',
         'minimumSpend',
         'eligibleUserTypes',
         'maxRedemptions',
         'maxPerUser',
      ];

      const extraFields = Object.keys(req.body).filter(
         (field) => !allowedFields.includes(field),
      );
      if (extraFields.length > 0) {
         return res.status(400).json({
            errors: extraFields.map((field) => ({
               msg: `Unexpected field: ${field} not allowed for posting promo code`,
               param: field,
            })),
         });
      }

      next();
   },
];
