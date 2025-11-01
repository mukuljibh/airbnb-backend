import { query, validationResult } from 'express-validator';

// export const validateGetAllReservations = [
//    query('sortField')
//       .default('createdAt')
//       .trim()
//       .isIn([
//          'checkInDate',
//          'checkOutDate',
//          'pricePerNight',
//          'numberOfNights',
//          'firstName',
//          'createdAt',
//          'propertyTitle',
//       ])
//       .withMessage(
//          "sort field must be one of 'checkInDate', 'checkOutDate', 'pricePerNight', 'numberOfNights', 'firstName', 'createdAt', 'propertyTitle'",
//       ),

//    query('status')
//       .default('all')
//       .trim()
//       .isIn(['upcoming', 'completed', 'cancelled', 'ongoing', 'all'])
//       .withMessage(
//          'these are valid status values: upcomming | completed | cancelled | ongoing | all ',
//       ),

//    query('sortOrder')
//       .default('desc')
//       .trim()
//       .isIn(['asc', 'desc'])
//       .withMessage("sort order must be either 'asc' or 'desc'"),

//    query('searchTerm')
//       .optional()
//       .trim()
//       .isString()
//       .withMessage('searchTerm must be string'),

//    (req, res, next) => {
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//          return res.status(400).json({ errors: errors.array() });
//       }
//       next();
//    },
// ];


// export const validateGetAllReservationsHostAndAdminSide = [
//    query('sortField')
//       .default('createdAt')
//       .trim()
//       .isIn([
//          'checkInDate',
//          'checkOutDate',
//          'pricePerNight',
//          'numberOfNights',
//          'firstName',
//          'createdAt',
//          'propertyTitle',
//       ])
//       .withMessage(
//          "sort field must be one of 'checkInDate', 'checkOutDate', 'pricePerNight', 'numberOfNights', 'firstName', 'createdAt', 'propertyTitle'",
//       ),

//    query('status')
//       .default('all')
//       .trim()
//       .isIn(['open', 'complete', 'cancelled', 'all', 'awaiting_confirmation'])
//       .withMessage(
//          'these are valid status values : complete | cancelled | open | all ',
//       ),

//    query('sortOrder')
//       .default('desc')
//       .trim()
//       .isIn(['asc', 'desc'])
//       .withMessage("sort order must be either 'asc' or 'desc'"),

//    query('searchTerm')
//       .optional()
//       .trim()
//       .isString()
//       .withMessage('searchTerm must be string'),

//    (req, res, next) => {
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//          return res.status(400).json({ errors: errors.array() });
//       }
//       next();
//    },
// ];



export const validateGetAllReservations = (role = 'guest') => {

   const statusValuesByRole = {
      guest: ['upcoming', 'completed', 'cancelled', 'ongoing', 'all'],
      host: ['open', 'complete', 'cancelled', 'all', 'awaiting_confirmation', 'ongoing', 'ariving_today', 'departure_today'],
      admin: ['open', 'complete', 'cancelled', 'all', 'awaiting_confirmation'],

   };

   return [
      query('sortField')
         .default('createdAt')
         .trim()
         .isIn([
            'checkInDate',
            'checkOutDate',
            'pricePerNight',
            'numberOfNights',
            'firstName',
            'createdAt',
            'propertyTitle',
         ])
         .withMessage(
            "sort field must be one of 'checkInDate', 'checkOutDate', 'pricePerNight', 'numberOfNights', 'firstName', 'createdAt', 'propertyTitle'",
         ),

      query('status')
         .default('all')
         .trim()
         .isIn(statusValuesByRole[role])
         .withMessage(
            `These are valid status values: ${statusValuesByRole[role].join(' | ')}`
         ),

      query('sortOrder')
         .default('desc')
         .trim()
         .isIn(['asc', 'desc'])
         .withMessage("sort order must be either 'asc' or 'desc'"),

      query('searchTerm')
         .optional()
         .trim()
         .isString()
         .withMessage('searchTerm must be string'),

      (req, res, next) => {
         const errors = validationResult(req);
         if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
         }
         next();
      },
   ];
};