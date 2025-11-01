import express from 'express';
import * as generalPropertyController from '../../../controllers/general/properties/properties.controller';
import * as commonPropertyMetaController from '../../../controllers/common/property/property.controller';
import { propertyPriceValidation } from '../../../validation/general/property/general.properties.validation';
import verifyRoutesAndAuthorizedRoles from '../../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import verifyUserAccountStatus from '../../../middleware/authorization/verifyUserStatus';

const router = express.Router();

/* 
|-------------------------------------------------------------------------- 
| Property Metadata Routes (Static first)
|-------------------------------------------------------------------------- 
*/
router.get('/amenities', commonPropertyMetaController.getAllAmenitiesGroupByTag);
router.get('/categories', commonPropertyMetaController.getCategories);

/* 
|-------------------------------------------------------------------------- 
| Property Search & Discovery Routes (Static first)
|-------------------------------------------------------------------------- 
*/
router.get('/search', generalPropertyController.propertySearch);
router.get('/filter-property', generalPropertyController.getFilterProperties);
router.get('/explore-stays', generalPropertyController.getExploreStays);
router.get('/trending-stays', generalPropertyController.getTrendingStaysThisWeek);
router.get('/recommended-stays', generalPropertyController.getRecommendedStays);

/* 
|-------------------------------------------------------------------------- 
| Reporting Routes
|-------------------------------------------------------------------------- 
*/
router.get('/report-flow', generalPropertyController.getReportFlow);
router.post('/:id/reports', verifyUserAccountStatus, verifyRoutesAndAuthorizedRoles('guest'), generalPropertyController.submitUserReport);

/* 
|-------------------------------------------------------------------------- 
| Property-Specific Operations 
|-------------------------------------------------------------------------- 
*/
// --> estimate earnings
router.get('/estimate-earnings', generalPropertyController.calculateEstimateEarnings);

// --> property reviews
router.get('/:propertyId/reviews', generalPropertyController.getPropertiesReviewsById);

// --> calculate property price
router.get('/:propertyId/calculate-price', propertyPriceValidation, generalPropertyController.getPropertiesPricingById);

/* 
|-------------------------------------------------------------------------- 
| Get Full Property Details 
|-------------------------------------------------------------------------- 
*/
router.get('/:id', generalPropertyController.getFullPropertyByIdForHostAndUser);

export default router;
