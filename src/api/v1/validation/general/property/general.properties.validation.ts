import { query, validationResult, body } from 'express-validator';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { dateRegex } from '../../../constant/regex.constant';

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




export const validatePropertyUpdate = [
   // ✅ GALLERY
   body('gallery')
      .optional()
      .isArray({ min: 0 }).withMessage('Gallery must be an array'),

   body('gallery.*.url')
      .if(body('gallery').exists())
      .notEmpty().withMessage('Gallery image URL is required')
      .isString().withMessage('Gallery image URL must be a string'),

   body('gallery.*.caption')
      .isString().withMessage('Caption must be a string'),

   body('gallery.*.isPrimary')
      .optional()
      .isBoolean().withMessage('isPrimary must be a boolean'),

   // ✅ LOCATION
   body('location')
      .optional()
      .isObject().withMessage('Location must be an object'),

   body('location.address')
      .if(body('location').exists())
      .notEmpty().withMessage('Address is required'),

   body('location.city')
      .if(body('location').exists())
      .notEmpty().withMessage('City is required'),

   body('location.zipCode')
      .if(body('location').exists())
      .notEmpty().withMessage('Zip code is required'),

   body('location.country')
      .if(body('location').exists())
      .notEmpty().withMessage('Country is required'),

   body('location.state')
      .if(body('location').exists())
      .notEmpty().withMessage('State is required'),

   body('location.landmark')
      .if(body('location').exists())
      .notEmpty().withMessage('Landmark is required'),

   body('location.coordinates.latitude')
      .if(body('location.coordinates').exists())
      .isNumeric().withMessage('Latitude must be a number'),

   body('location.coordinates.longitude')
      .if(body('location.coordinates').exists())
      .isNumeric().withMessage('Longitude must be a number'),

   // ✅ DOCUMENTS
   body('documents')
      .optional()
      .isArray({ min: 0 }).withMessage('document must be array'),

   body('documents.*.documentType')
      .if(body('documents').exists())
      .notEmpty().withMessage('Document type is required')
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
      ]).withMessage('Invalid document type'),

   body('documents.*.documentUrl')
      .if(body('documents').exists())
      .notEmpty().withMessage('Document URL is required')
      .isString().withMessage('Document URL must be a string'),
   body('changedFields')
      .exists({ checkFalsy: true })
      .withMessage('changedFields is required and cannot be empty')
      .isArray({ min: 1 })
      .withMessage('changedFields must be a non-empty array'),

   body('changedFields.*')
      .isIn(['location', 'gallery', 'documents'])
      .withMessage('Each item in changedFields must be one of: location, gallery, documents'),


   body('rejectedFields')
      .optional()
      .isArray({ min: 0 }),

   body('rejectedFields.*')
      .isIn(['location', 'gallery', 'documents'])
      .withMessage('Each item in changedFields must be one of: location, gallery, documents'),

   body('hostRemark')
      .exists({ checkFalsy: true })
      .withMessage('hostRemark is required')
      .isString()
      .withMessage('hostRemark must be a string')
      .trim()
      .notEmpty()
      .withMessage('hostRemark cannot be empty'),


   // ✅ Custom validator: at least one of them must be present and non-empty
   body().custom((value, { req }) => {
      const { gallery, location, documents } = req.body;

      const hasGallery = Array.isArray(gallery) && gallery.length > 0;
      const hasLocation = location && typeof location === 'object' && Object.keys(location).length > 0;
      const hasDocuments = Array.isArray(documents) && documents.length > 0;

      if (!hasGallery && !hasLocation && !hasDocuments) {
         throw new Error('At least one of gallery, location, or documents must be provided');
      }

      return true;
   }),

   (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
      }
      next();
   },
];
