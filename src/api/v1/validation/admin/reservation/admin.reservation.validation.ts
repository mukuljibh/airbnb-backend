import { query, validationResult } from 'express-validator';

export const validateGetAllTransations = [
   query('transactionType')
      .default('PAYMENT')
      .trim()
      .isIn(['PAYMENT', 'REFUND'])
      .withMessage('transactionType must be PAYMENT | REFUND'),
   query('sortField')
      .default('createdAt')
      .trim()
      .isIn(['createdAt', 'firstName', 'status'])
      .withMessage(
         "sort field must be one of 'createdAt', 'guestName', 'status' ",
      ),

   query('status')
      .default('all')
      .trim()
      .isIn(['processing', 'paid', 'failed', 'all', 'refunded'])
      .withMessage(
         'these are valid status values: processing | paid | failed | all | refunded',
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
