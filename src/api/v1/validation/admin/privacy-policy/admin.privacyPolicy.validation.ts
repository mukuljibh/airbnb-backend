import { body, validationResult } from 'express-validator';

export const validatePrivacyPolicy = [
   body('title').trim().notEmpty().withMessage('Title is required').escape(),
   body('type')
      .trim()
      .notEmpty()
      .withMessage('Type is required')
      .isIn([
         'privacyPolicy',
         'termsConditions',
         'refundPolicy',
         'bookingCancellationPolicy',
      ])
      .withMessage(
         "Invalid type, must be 'privacyPolicy' or 'termsConditions'  'refundPolicy' 'bookingCancellationPolicy'",
      )
      .escape(),
   body('body').trim().notEmpty().withMessage('Body content is required'),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];
