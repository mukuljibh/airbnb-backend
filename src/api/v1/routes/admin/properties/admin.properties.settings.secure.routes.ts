import express from 'express';
import { validateAddAmenities } from '../../../validation/admin/propertyMeta/admin.property.meta.validation';
import * as adminPropertyMetaController from '../../../controllers/admin/propertyMeta/admin.property.meta.controller';

import createPages from '../../../middleware/pagination/createPages';
import * as commonPropertyController from '../../../controllers/common/property/common.property.controller';
import { analyticsStatisticsProperty } from '../../../controllers/admin/analytics/admin.analytics.controller';
import * as commonPropertyMetaController from '../../../controllers/common/propertyMeta/common.property.meta.controller';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Analytics & Property Listing Routes
|--------------------------------------------------------------------------
*/
router.get('/analytics-statistics', analyticsStatisticsProperty);
router.get('/', createPages, commonPropertyController.getPropertiesList);

/* 
|--------------------------------------------------------------------------
| Amenities Management Routes
|--------------------------------------------------------------------------
*/
router.get('/amenities', commonPropertyMetaController.getAllAmenities);
router.post(
   '/amenities',
   validateAddAmenities,
   adminPropertyMetaController.addAmenities,
);
router.get(
   '/amenities/:tagId',
   adminPropertyMetaController.getAmenitiesByTagId,
);
router.patch(
   '/amenities/:tagId',
   adminPropertyMetaController.updateOrDeleteAmenitiesByTagId,
);
router.delete(
   '/amenities/:tagId',
   adminPropertyMetaController.deleteAmenityByTagId,
);
router.patch(
   '/amenities/toggle-status/:tagId',
   adminPropertyMetaController.toggleAmenityTagStatus,
);
router.post('/amenity/:tagId', adminPropertyMetaController.addAmenity);

/* 
|--------------------------------------------------------------------------
| Category Management Routes
|--------------------------------------------------------------------------
*/
router.get('/categories', commonPropertyMetaController.getCategories);
router.post('/category', adminPropertyMetaController.addCategory);
router.get(
   '/category/:categoryId',
   adminPropertyMetaController.getCategoryById,
);
router.patch(
   '/category/:categoryId',
   adminPropertyMetaController.updateCategory,
);
router.delete(
   '/category/:categoryId',
   adminPropertyMetaController.deleteCategory,
);

/* 
|--------------------------------------------------------------------------
| Property Verification & Approval Route
|--------------------------------------------------------------------------
*/
router.post(
   '/approve/:propertyId',
   adminPropertyMetaController.approveUserDraft,
);

/* 
|--------------------------------------------------------------------------
| Single Property Retrieval Route (Placed Last to Avoid Conflicts)
|--------------------------------------------------------------------------
*/
router.get('/:id', commonPropertyController.getFullPropertyById);

export default router;
