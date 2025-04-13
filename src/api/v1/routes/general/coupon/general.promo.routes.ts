import express from 'express';
import * as commonPromoController from '../../../controllers/common/coupon/common.coupon.controller';

const router = express.Router();

/* 
|-------------------------------------------------------------------------- 
| Coupon Management Routes 
|-------------------------------------------------------------------------- 
*/

router.get('/get-promos', commonPromoController.getAllPromos);
router.post('/apply-promo', commonPromoController.applyPromo);

export default router;
