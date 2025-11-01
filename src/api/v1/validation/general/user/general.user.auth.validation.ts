import { body, validationResult } from 'express-validator';
import parsePhoneNumber from 'libphonenumber-js';
import {
   emailRegix,
   passwordRegex,
   DobRegix,
} from '../../../constant/regex.constant';
import { pick } from 'lodash';

export const validateSendOtp = [
   body('criteria')
      .notEmpty()
      .withMessage('Criteria is mandatory')
      .trim()
      .bail()
      .isIn(['EMAIL', 'PHONE'])
      .withMessage('Criteria must be either EMAIL or PHONE'),
   body('email')
      .if(body('criteria').equals('EMAIL'))
      .notEmpty()
      .withMessage('email is mandatory')
      .trim()
      .bail()
      .custom((value) => emailRegix.test(value))

      .withMessage('Email is invalid')
      .custom((value, { req }) => {
         // Ensure that phone is not present when criteria is EMAIL
         if (req.body.phone) {
            throw new Error(
               'Phone number should not be provided when criteria is EMAIL',
            );
         }
         return true;
      }),
   body('type')
      .notEmpty()
      .withMessage('type is mandatory')
      .trim()
      .bail()
      .isIn(['SIGN_UP_OTP', 'FORGET_PASSWORD_OTP'])
      .withMessage(
         'Invalid type it should be one of the following SIGN_UP_OTP | FORGET_PASSWORD_OTP.',
      ),

   body('phone')
      .if(body('criteria').equals('PHONE'))
      .notEmpty()
      .withMessage('Phone is mandatory when criteria is PHONE')
      .trim()
      .bail()
      .custom((value) => {
         const phoneNumber = parsePhoneNumber(value);
         if (!phoneNumber || !phoneNumber.isValid()) {
            throw new Error('Invalid phone number format');
         }
         return true;
      })
      .custom((value, { req }) => {
         if (req.body.email) {
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
      if (req.body?.phone) {
         req.body.phone = pick({ ...parsePhoneNumber(req.body.phone) }, [
            'country',
            'countryCallingCode',
            'number',
         ]);
      }

      next();
   },
];
export const validateVerifyOtp = [
   body('otp').notEmpty().withMessage('otp is mandatory'),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];

export const ValidateLogin = [
   body('loginKey')
      .notEmpty()
      .withMessage(
         'loginKey attribute must contain valid (email or phone) is required',
      ),
   body('password').notEmpty().withMessage('password is mandatory'),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];
export const validateProfile = [
   body('firstName')
      .trim()
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ min: 2, max: 25 })
      .withMessage('First name must be at least 2 characters'),

   body('lastName')
      .trim()
      .notEmpty()
      .withMessage('lastName is mandatory')
      .isLength({ min: 2, max: 25 })
      .withMessage('First name must be at least 2 characters'),

   body('contactEmail')
      .trim()
      .notEmpty()
      .withMessage('contact email is mandatory')
      .bail()
      .custom((value) => emailRegix.test(value))
      .withMessage('Email is invalid'),

   body('password')
      .trim()
      .notEmpty()
      .withMessage('password is mandatory')
      .bail()
      .custom((value) => passwordRegex.test(value))
      .withMessage(
         'Password must be 8-15 characters, including an uppercase letter, lowercase letter, number, and special character (@.#$!%*?&)—no spaces.',
      ),

   body('dob')
      .notEmpty()
      .withMessage('date of birth is mandatory')
      .bail()
      .custom((value) => DobRegix.test(value))
      .withMessage(
         'Invalid date format. Please provide a valid date ex-: 31-10-2000.',
      ),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];

export const validateChangePassword = [
   body('password')
      .notEmpty()
      .withMessage('password is mandatory')
      .bail()
      .custom((value) => passwordRegex.test(value))
      .withMessage(
         'Password must be 8-15 characters, including an uppercase letter, lowercase letter, number, and special character (@.#$!%*?&)—no spaces.',
      ),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];
