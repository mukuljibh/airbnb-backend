import { body, query, validationResult } from 'express-validator';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { dateRegex } from '../../../constant/regex.constant';

export const validateReservation = [
   query('propertyid').notEmpty().withMessage('propertyid is mandatory').bail(),
   query('checkin')
      .notEmpty()
      .withMessage('checkin is mandatory')
      .isDate()
      .withMessage("'date must be valid date format ex : 2024-01-30'"),
   query('checkout')
      .notEmpty()
      .withMessage('checkout is mandatory')
      .isDate()
      .withMessage("'date must be valid date format ex : 2024-01-30'")
      .custom((value, { req }) => {
         const checkinDate = new Date(req.query.checkin);
         const checkoutDate = new Date(value);

         if (checkoutDate <= checkinDate) {
            throw new Error('checkout must be greater than checkin');
         }
         return true;
      }),
   query('child').optional().isInt().withMessage('child must be number'),
   query('adult').optional().isInt().withMessage('adult must be number'),
   query('guest').optional().isInt().withMessage('guest must be number'),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];

export const validateReservationPayment = [
   body('name')
      .exists()
      .withMessage('Guest name is mandatory')
      .isString()
      .withMessage('Guest name must be a string')
      .trim(),

   body('email')
      .exists()
      .withMessage('Guest email is mandatory')
      .isString()
      .withMessage('Guest email must be a string')
      .trim(),
   body('phone')
      .exists()
      .withMessage('Guest phone is mandatory')
      .isString()
      .withMessage('Guest phone must be a string')
      .trim(),

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
         const checkIn = new Date(req.query.checkIn);
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
