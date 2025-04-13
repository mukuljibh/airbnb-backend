import { body, validationResult } from 'express-validator';
import { emailRegix } from '../../../utils/regex/regex.constant';
import parsePhoneNumber from 'libphonenumber-js';
import { pick } from 'lodash';

export const validateAccountSendOtp = [
   body('criteria')
      .notEmpty()
      .trim()
      .withMessage('Criteria is mandatory')
      .bail()
      .isIn(['EMAIL', 'PHONE'])
      .withMessage('Criteria must be either EMAIL or PHONE'),
   body('newEmail')
      .if(body('criteria').equals('EMAIL'))
      .trim()

      .notEmpty()
      .withMessage('newEmail is mandatory')
      .bail()
      .custom((value) => emailRegix.test(value))

      .withMessage('newEmail is invalid')
      .custom((value, { req }) => {
         // Ensure that phone is not present when criteria is EMAIL
         if (req.body.newPhone) {
            throw new Error(
               'Phone number should not be provided when criteria is EMAIL',
            );
         }
         return true;
      }),
   body('type')
      .notEmpty()
      .trim()

      .withMessage('type is mandatory')
      .bail()
      .isIn(['UPDATE'])
      .withMessage('Invalid type it should be one of the following [UPDATE].'),

   body('newPhone')
      .if(body('criteria').equals('PHONE'))
      .trim()
      .notEmpty()
      .withMessage('newPhone is mandatory when criteria is PHONE')
      .bail()
      .custom((value) => {
         const phoneNumber = parsePhoneNumber(value);
         if (!phoneNumber || !phoneNumber.isValid()) {
            throw new Error('Invalid phone number format');
         }
         return true;
      })
      .custom((value, { req }) => {
         if (req.body?.newEmail) {
            throw new Error(
               'Email should not be provided when criteria is PHONE',
            );
         }
         return true;
      }),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      if (req.body?.newPhone) {
         req.body.newPhone = pick({ ...parsePhoneNumber(req.body.newPhone) }, [
            'country',
            'countryCallingCode',
            'number',
         ]);
      }

      next();
   },
];

export const validateAccountUpdateProfile = [
   body('firstName')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ min: 2 })
      .withMessage('First name must be at least 2 characters'),

   body('lastName')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ min: 2 })
      .withMessage('Last name must be at least 2 characters'),

   body('flatNo')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Flat No is required'),

   body('street')
      .exists()
      .withMessage('street address is required')
      .trim()
      .notEmpty()
      .withMessage('Street Address can not be empty'),

   body('city').optional().trim(),

   body('state').optional().trim(),

   body('country')
      .exists()
      .withMessage('country is required')
      .trim()
      .notEmpty()
      .withMessage('Country can not be empty'),

   body('pincode')
      .exists()
      .withMessage('pincode is required')
      .trim()
      .notEmpty()
      .withMessage('pincode can not be empty')
      .isLength({ min: 3, max: 10 })
      .withMessage('Pincode must be between 3 to 10 characters'),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];
