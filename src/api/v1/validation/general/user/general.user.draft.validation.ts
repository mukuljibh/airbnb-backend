import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';

export const validateCheckpoint = [
   body('stage')
      .exists()
      .withMessage('Stage is required')
      .isIn([1, 2, 3, 4, 5, 6])
      .withMessage('Invalid checkpoint stage')
      .toInt(),

   // Checkpoint 1 validation
   body('propertyTitle')
      .if(body('stage').equals('1'))
      .exists()
      .withMessage('propertyTitle is required for stage 1')
      .trim()
      .notEmpty()
      .withMessage('propertyTitle cannot be empty')
      .isString()
      .withMessage('propertyTitle must be a string')
      .escape(),

   body('propertyCity')
      .optional({ nullable: true, checkFalsy: true })
      .if(body('stage').equals('1'))
      .trim()
      .isString()
      .withMessage('propertyCity must be a string')
      .isLength({ min: 1, max: 50 })
      .withMessage('propertyCity must be 1-50 characters'),
   body('experienceTags')
      .optional()
      .if(body('stage').equals('1'))
      .trim()
      .notEmpty()
      .withMessage('experienceTag cannot be empty')
      .isIn(['beach', 'culture', 'ski', 'family', 'wellnessAndRelaxation'])
      .withMessage(
         'experienceTag must be either beach | culture | ski | family | wellnessAndRelaxation',
      ),

   body('propertyType')
      .if(body('stage').equals('1'))
      .exists()
      .withMessage('propertyType is required for stage 1')
      .trim()
      .notEmpty()
      .withMessage('propertyType cannot be empty')
      .isIn([
         'hotel',
         'guest house',
         'resort',
         'apartment',
         'house',
         'condo',
         'townhouse',
         'villa',
         'flat',
      ])
      .withMessage(
         'propertyType must be either flat | hotel | resort | apartment | house | condo | townhouse | villa | guest house',
      ),

   body('propertyPlaceType')
      .if(body('stage').equals('1'))
      .exists()
      .withMessage('propertyPlaceType is required for stage 1')
      .trim()
      .notEmpty()
      .withMessage('propertyPlaceType cannot be empty')
      .isIn(['any', 'room', 'entire-home'])
      .withMessage('propertyPlaceType must be either any | room | entire-home'),

   body('propertyCategoryId')
      .if(body('stage').equals('1'))
      .exists()
      .withMessage('propertyCategoryId is required for stage 1')
      .trim()
      .notEmpty()
      .withMessage('propertyCategoryId cannot be empty')
      .isString()
      .withMessage('propertyCategoryId must be a string')
      .isLength({ min: 1, max: 50 })
      .custom((value) => {
         if (!mongoose.Types.ObjectId.isValid(value)) {
            throw new Error(
               'propertyCategoryId must be a valid MongoDB ObjectId',
            );
         }
         return true;
      }),

   body('propertyCountry')
      .if(body('stage').equals('1'))
      .exists()
      .withMessage('propertyCountry is required for stage 1')
      .trim()
      .notEmpty()
      .withMessage('propertyCountry cannot be empty')
      .isString()
      .withMessage('propertyCountry must be a string')
      .isLength({ min: 1, max: 50 }),

   body('propertyState')
      .optional({ nullable: true, checkFalsy: true })
      .if(body('stage').equals('1'))
      .trim()
      .notEmpty()
      .withMessage('propertyState cannot be empty')
      .isString()
      .withMessage('propertyState must be a string')
      .isLength({ min: 1, max: 50 })
      .withMessage('propertyCountry must be 1-50 characters'),

   body('propertyDescription')
      .if(body('stage').equals('1'))
      .exists()
      .withMessage('propertyDescription is required for stage 1')
      .trim()
      .notEmpty()
      .withMessage('propertyDescription cannot be empty')
      .isString()
      .withMessage('propertyDescription must be a string'),

   body('propertyGallery')
      .optional()
      .if(body('stage').equals('1'))
      .isArray()
      .withMessage('propertyGallery must be an array')
      .custom((value) => {
         // Ensure each object in the array matches the required structure
         if (value.length < 5) {
            throw new Error(`Please Provide At least 5 images to continue`);
         }
         value.forEach((item, index) => {
            if (typeof item.url !== 'string') {
               throw new Error(
                  `propertyGallery item at index ${index} must have a valid URL (string)`,
               );
            }
            if (typeof item.caption !== 'string') {
               throw new Error(
                  `propertyGallery item at index ${index} must have a valid caption (string)`,
               );
            }
            if (typeof item.isPrimary !== 'boolean') {
               throw new Error(
                  `propertyGallery item at index ${index} must have a valid isPrimary (boolean)`,
               );
            }
         });
         return true;
      }),

   body('propertyAddress')
      .if(body('stage').equals('1'))
      .exists()
      .withMessage('propertyAddress is required for stage 1')
      .trim()
      .notEmpty()
      .withMessage('propertyAddress cannot be empty')
      .isString()
      .withMessage('propertyAddress must be a string'),

   body('availabilityWindow')
      .if(body('stage').equals('1'))
      .exists()
      .withMessage('availabilityWindow  is required for stage 1')
      .notEmpty()
      .withMessage('availabilityWindow  cannot be empty')
      .isInt({ min: 1 })
      .withMessage('availabilityWindow must be a positive integer')
      .isIn([1, 3, 6, 12])
      .withMessage(
         'availabilityWindow must be one of: 1, 3, 6, or 12 (months)',
      ),
   body('propertyLandmark')
      .if(body('stage').equals('1'))
      .optional()
      .trim()
      .isString()
      .withMessage('propertyLandmark must be a string'),

   body('propertyZipcode')
      .if(body('stage').equals('1'))
      .trim()
      .custom((value) => {
         if (value === '') return true;

         if (typeof value !== 'string') throw new Error('ZIP code must be a string');
         if (value.length > 10) throw new Error('ZIP code must be at most 10 characters');
         return true;
      }),

   body('propertyBaseCurrency')
      .optional()
      .if(body('stage').equals('1'))
      .trim()
      .notEmpty()
      .withMessage('propertyBaseCurrency cannot be empty')
      .isString()
      .withMessage('Property propertyBaseCurrency must be a string'),

   body('propertyCoordinates')
      .if(body('stage').equals('1'))
      .exists()
      .withMessage('propertyCoordinates is required for stage 1')
      .isObject()
      .withMessage('propertyCoordinates must be an object')
      .custom((value) => {
         const { longitude, latitude } = value;
         if (
            typeof latitude === 'undefined' ||
            typeof longitude === 'undefined'
         )
            throw new Error('Both latitude and longitude are required');

         if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            throw new Error('Both latitude and longitude must be numbers');
         }

         if (latitude < -90 || latitude > 90)
            throw new Error('Latitude must be between -90 and 90');

         if (longitude < -180 || longitude > 180)
            throw new Error('Longitude must be between -180 and 180');
         return true;
      }),

   // Checkpoint 2 validation
   body('bedRooms')
      .if(body('stage').equals('2'))
      .optional()
      .isInt({ min: 0, max: 50 })
      .withMessage('bedRooms must be a valid number'),

   body('beds')
      .if(body('stage').equals('2'))
      .optional()
      .isInt({ min: 0, max: 50 })
      .withMessage('noOfBed must be a valid number'),

   body('maxGuest')
      .if(body('stage').equals('2'))
      .optional()
      .isInt({ min: 0, max: 50 })
      .withMessage('maxGuest must be a valid number'),

   body('bathRooms')
      .if(body('stage').equals('2'))
      .optional()
      .isInt({ min: 0, max: 50 })
      .withMessage('bathRooms must be a valid number'),

   body('amenities')
      .if(body('stage').equals('2'))
      .optional()
      .isArray()
      .withMessage('Amenities must be an array'),

   // Checkpoint 3 validation
   body('pricePerNight')
      .if(body('stage').equals('3'))
      .exists()
      .withMessage('Price per night is required for stage 3')
      .trim()
      .notEmpty()
      .withMessage('Price per night cannot be empty')
      .isFloat({ min: 0 })
      .withMessage('Price per night must be a positive number'),

   body('cleaningFees')
      .optional()
      .if(body('stage').equals('3'))
      .trim()
      .isFloat({ min: 0 })
      .withMessage('Cleaning fees must be a 0 or positive number'),

   body('weeklyRateDiscount')
      .optional()
      .if(body('stage').equals('3'))
      .trim()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Weekly rate discount must be a number between 0 and 100'),

   body('serviceFees')
      .optional()
      .if(body('stage').equals('3'))
      .trim()
      .isFloat({ min: 0 })
      .withMessage('serviceFees fees must be a 0 or positive number'),

   body('monthlyRateDiscount')
      .optional()
      .if(body('stage').equals('3'))
      .trim()
      .isFloat({ min: 1, max: 100 })
      .withMessage('Monthly rate discount must be a number between 1 and 100'),

   // Checkpoint 4 validation
   body('housingRules')
      .if(body('stage').equals('4'))
      .notEmpty()
      .withMessage('housingRules cannot be empty')
      .isString()
      .withMessage('housingRules must be a string')
      .trim(),

   body('cancellationPolicy')
      .optional()
      .if(body('stage').equals('4'))
      .exists()
      .withMessage('cancellationPolicy is required for stage 4')
      .isObject()
      .withMessage(
         'cancellationPolicy must be an object with description',
      )
      .custom((policy) => {
         if (
            !['flexible', 'moderate', 'strict', 'non-refundable'].includes(
               policy.type,
            )
         ) {
            throw new Error(
               'type must be one of: flexible, moderate, strict, non-refundable',
            );
         }
         return true;
      }),

   body('checkInTime')
      .if(body('stage').equals('4'))
      .exists()
      .withMessage('checkInTime is required for stage 4')
      .isString()
      .withMessage('checkInTime must be a string')
      .trim(),

   body('checkOutTime')
      .if(body('stage').equals('4'))
      .exists()
      .withMessage('checkOutTime is required for stage 4')
      .isString()
      .withMessage('checkOutTime must be a string')
      .trim(),

   body('safetyAndProperty')
      .if(body('stage').equals('4'))
      .exists()
      .withMessage('safetyAndProperty is required for stage 4')
      .isString()
      .withMessage('safetyAndProperty must be a string')
      .trim(),

   // Checkpoint 5 validation
   body('isPetAllowed')
      .if(body('stage').equals('5'))
      .exists()
      .withMessage('isPetAllowed is required for stage 5')
      .isBoolean()
      .withMessage('isPetAllowed must be a boolean')
      .notEmpty()
      .withMessage('isPetAllowed cannot be empty'),

   body('isHaveSelfCheckin')
      .if(body('stage').equals('5'))
      .optional()
      .isBoolean()
      .withMessage('isHaveSelfCheckin must be a boolean'),

   body('isHaveInstantBooking')
      .if(body('stage').equals('5'))
      .optional()
      .isBoolean()
      .withMessage('isHaveInstantBooking must be a boolean'),

   body('generalNote')
      .if(body('stage').equals('5'))
      .optional()
      .isString()
      .withMessage('generalNote must be a string'),

   body('nearByAttractionNote')
      .if(body('stage').equals('5'))
      .optional()
      .isString()
      .withMessage('nearByAttractionNote must be string'),

   body('documents')
      .if(body('stage').equals('6'))
      .exists()
      .withMessage('documents array is required for stage 6')
      .isArray({ min: 1 })
      .withMessage('documents must be a non-empty array')
      .custom((documents) => {
         const hasGovID = documents.some(
            (doc) => doc.documentType === 'government-issued ID',
         );
         if (!hasGovID) {
            throw new Error(
               'At least one document must be a government-issued ID in stage 6',
            );
         }
         return true;
      }),
   body('documents.*.documentType')
      .if(body('stage').equals('6'))
      .exists()
      .withMessage('documentType  is required for each document in stage 6')
      .notEmpty()
      .withMessage('documentType cannot be empty')
      .isIn([
         'government-issued ID',
         'rental agreement',
         'land registry document',
         'electricity bill',
         'water bill',
         'property tax receipt',
         'property deed',
         'gas bill',
         'No Objection Certificate',
      ])

      .withMessage(
         'documentType must be one of: "electricity bill", "water bill", "property tax receipt", "rental agreement", "property deed", "gas bill", "land registry document", "No Objection Certificate"',
      ),

   body('documents.*.documentUrl')
      .if(body('stage').equals('6'))
      .exists()
      .withMessage('documentUrl is required for each document in stage 6')
      .notEmpty()
      .withMessage('documentUrl cannot be empty')
      .isString()
      .withMessage('documentUrl must be a string'),
   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }

      // Ensure no extra fields for each stage
      const allowedFields = {
         1: [
            'stage',
            'propertyPlaceType',
            'propertyType',
            'availabilityWindow',
            'propertyDescription',
            'propertyCity',
            'propertyState',
            'propertyCountry',
            'propertyAvailabilityDates',
            'propertyTitle',
            'propertyGallery',
            'propertyLandmark',
            'propertyZipcode',
            'propertyCategoryId',
            'propertyAddress',
            'propertyCoordinates',
            "propertyBaseCurrency",
            'experienceTags',
         ],
         2: ['stage', 'bedRooms', 'bathRooms', 'beds', 'maxGuest', 'amenities'],
         3: [
            'stage',
            'pricePerNight',
            'cleaningFees',
            'serviceFees',
            'weeklyRateDiscount',
            'monthlyRateDiscount',
            'capacity',
            'firstThreeBookingsDiscount',
            'currency'

         ],
         4: [
            'stage',
            'housingRules',
            'safetyAndProperty',
            'cancellationPolicy',
            'checkInTime',
            'checkOutTime',
         ],
         5: [
            'stage',
            'isPetAllowed',
            'generalNote',
            'nearByAttractionNote',
            'isHaveSelfCheckin',
            'isHaveInstantBooking',
            'hasInstantBooking',
            'hasSelfBooking'
         ],
         6: ['stage', 'documents', 'lastStatus', 'reason'],
      };

      const extraFields = Object.keys(req.body).filter(
         (field) => !allowedFields[req.body.stage].includes(field),
      );
      if (extraFields.length > 0) {
         return res.status(400).json({
            errors: extraFields.map((field) => ({
               msg: `Unexpected field: ${field} not allowed for stage ${req.body.stage}`,
               param: field,
            })),
         });
      }

      next();
   },
];
