import express from 'express';

import * as adminPromoController from '../../../controllers/admin/promo/promo.controller';
import { validatePromoCodePost } from '../../../validation/admin/propertyMeta/admin.property.meta.validation';
import createPages from '../../../middleware/pagination/pagination.middleware';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Coupon Management Routes
|--------------------------------------------------------------------------
*/

// Get all coupons with pagination
router.get('/', createPages, adminPromoController.getAllPromoCodes);

// Create a new coupon
router.post('/', validatePromoCodePost, adminPromoController.generatePromoCode);

// Get a single coupon by ID (should come before dynamic patch/delete routes to avoid conflicts)
router.get('/:promoId', adminPromoController.getSinglePromoById);

// Update an existing coupon by ID
router.patch(
   '/:promoId',
   validatePromoCodePost,
   adminPromoController.updatePromoCode,
);

// Toggle coupon active/inactive status
router.patch('/:promoId/toggle-status', adminPromoController.togglePromoStatus);

// Delete a coupon by ID
router.delete('/:promoId', adminPromoController.deletePromoCode);

export default router;
