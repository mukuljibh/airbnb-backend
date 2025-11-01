import express from 'express';
import { validateAddAmenities } from '../../../validation/admin/propertyMeta/admin.property.meta.validation';
import * as adminPropertyMetaController from '../../../controllers/admin/properties/property.controller';
import * as propertyUpdateController from '../../../controllers/admin/properties/update.controller';

import { analyticsStatisticsProperty } from '../../../controllers/admin/analytics/analytics.controller';
import * as commonPropertyMetaController from '../../../controllers/common/property/property.controller';
import { getPropertiesReviewsById } from '../../../controllers/general/properties/properties.controller';
import verifyRoutesAndAuthorizedRoles from '../../../middleware/authorization/verifyRoutesAndAuthorizedRoles';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Analytics & Property Listing Routes
|--------------------------------------------------------------------------
*/
router.get('/analytics-statistics', analyticsStatisticsProperty);
router.get('/', adminPropertyMetaController.getAdminPropertyListByFilter);

/* 
|--------------------------------------------------------------------------
| Amenities Management Routes
|--------------------------------------------------------------------------
*/
router.get('/amenities', commonPropertyMetaController.getAllAmenitiesGroupByTag);
router.post('/amenities', validateAddAmenities, adminPropertyMetaController.addAmenities);
router.patch('/amenities/:tagId', adminPropertyMetaController.updateOrDeleteAmenitiesByTagId);
router.delete('/amenities/:tagId', adminPropertyMetaController.deleteTagAndAllAmenitiesByTagId);
router.patch('/amenities/toggle-status/:tagId', adminPropertyMetaController.toggleAmenityTagStatus);

/* 
|--------------------------------------------------------------------------
| Category Management Routes
|--------------------------------------------------------------------------
*/
router.get('/categories', commonPropertyMetaController.getCategories);
router.post('/category', adminPropertyMetaController.addCategory);
router.get('/category/:categoryId', adminPropertyMetaController.getCategoryById);
router.patch('/category/:categoryId', adminPropertyMetaController.updateCategory);
router.delete('/category/:categoryId', adminPropertyMetaController.deleteCategory);

/* 
|--------------------------------------------------------------------------
| Reports Route
|--------------------------------------------------------------------------
*/
router.get('/reports', verifyRoutesAndAuthorizedRoles('admin'), adminPropertyMetaController.getUserReportList);

/* 
|--------------------------------------------------------------------------
| Property Verification & Approval Routes
|--------------------------------------------------------------------------
*/
router.post('/approve/:propertyId', adminPropertyMetaController.approveUserDraft);

// /* Pending property updates */
router.get('/updates', propertyUpdateController.getAllPendingPropertyUpdateApplications);
router.get('/:propertyId/updates/:updateId', propertyUpdateController.getSingleUpdateApplicationByUpdateId);
router.patch('/:propertyId/updates/:updateId/verify', propertyUpdateController.verifyPendingUpdatesByUpdateId);
router.get('/:propertyId/updates', propertyUpdateController.getAllPendingPropertyUpdateByPropertyId);

/* Change property status */
router.patch('/:propertyId/status', adminPropertyMetaController.changePropertyStateByAdmin);

/* 
|--------------------------------------------------------------------------
| Property-Specific Data
|--------------------------------------------------------------------------
*/
router.get('/:propertyId/reviews', getPropertiesReviewsById);

/* 
|--------------------------------------------------------------------------
| Single Property Retrieval
|--------------------------------------------------------------------------
*/
router.get('/:id', adminPropertyMetaController.getFullPropertyByIdForAdmin);

export default router;
