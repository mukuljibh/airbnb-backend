import { query, validationResult } from 'express-validator';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { dateRegex } from '../../../utils/regex/regex.constant';

export const propertyPriceValidation = [
   query('checkIn')
      .exists()
      .withMessage('Check-in date is mandatory')
      .matches(dateRegex)
      .withMessage(
         "Invalid check-in date format. Use 'YYYY-MM-DD', e.g., 2025-07-01.",
      )
      .toDate(),

   query('checkOut')
      .exists()
      .withMessage('Check-out date is mandatory')
      .matches(dateRegex)
      .withMessage(
         "Invalid check-out date format. Use 'YYYY-MM-DD', e.g., 2025-07-01.",
      )
      .custom((value, { req }) => {
         const checkIn = new Date(req.query.checkIn); // Fixed: Use req.query
         const checkOut = new Date(value);

         if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            throw new ApiError(400, 'Invalid check-in or check-out date.');
         }

         const dayDifference =
            (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24);
         if (dayDifference < 1) {
            throw new ApiError(
               400,
               'Check-out date must be at least 1 days after check-in.',
            );
         }

         return true;
      })
      .toDate(),

   query('adult')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Please provide a numeric value for adults (minimum 1).')
      .toInt(),

   query('child')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Please provide a numeric value for children (minimum 0).')
      .toInt(),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      if (req.query.adult === undefined) req.query.adult = 1;
      if (req.query.child === undefined) req.query.child = 0;
      next();
   },
];
